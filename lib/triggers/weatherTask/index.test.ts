import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherTaskPayload } from "./index";

// Замокан ответ Open-Meteo (fetchForecast) и репозиторий задач — провайдер
// проверяется как чистая функция от (задачи, прогноз), без реальной БД/сети.
vi.mock("./openMeteo", () => ({ fetchForecast: vi.fn() }));
vi.mock("./repository", () => ({ listTasksByEvent: vi.fn() }));

const { fetchForecast } = await import("./openMeteo");
const { listTasksByEvent } = await import("./repository");
const { weatherTaskProvider } = await import("./index");
const { weatherTaskConfigSchema } = await import("./config");

const eventId = "11111111-1111-1111-1111-111111111111";
const config = weatherTaskConfigSchema.parse({ location: { lat: 52.888, lon: 30.041 } });

function task(overrides: Partial<Awaited<ReturnType<typeof listTasksByEvent>>[number]> = {}) {
  return {
    id: "task-1",
    eventId,
    title: "Покос травы",
    intervalDays: 14,
    weatherRules: { minDryDaysInRow: 1, minTempC: 12, maxTempC: 28 },
    lastDoneAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function forecastFrom(today: string, days: Array<{ precip: number; tempMax: number; tempMin: number }>) {
  const start = new Date(`${today}T00:00:00Z`);
  const daily = days.map((d, i) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    const dateStr = date.toISOString().slice(0, 10);
    return {
      date: dateStr,
      precipitationMm: d.precip,
      tempMaxC: d.tempMax,
      tempMinC: d.tempMin,
      sunset: `${dateStr}T21:00`,
    };
  });
  return { timezone: "Europe/Minsk", daily, hourly: [] };
}

beforeEach(() => {
  vi.mocked(fetchForecast).mockReset();
  vi.mocked(listTasksByEvent).mockReset();
});

describe("weatherTaskProvider.check", () => {
  it("does not trigger and reports no_tasks when the event has no tasks", async () => {
    vi.mocked(listTasksByEvent).mockResolvedValue([]);

    const result = await weatherTaskProvider.check(config, { eventId });

    expect(result.triggered).toBe(false);
    expect((result.payload as WeatherTaskPayload).status).toBe("no_tasks");
    expect(fetchForecast).not.toHaveBeenCalled();
  });

  it("does not throw and reports an error payload when Open-Meteo fails", async () => {
    vi.mocked(listTasksByEvent).mockResolvedValue([task()]);
    vi.mocked(fetchForecast).mockRejectedValue(new Error("timeout"));

    const result = await weatherTaskProvider.check(config, { eventId });

    expect(result.triggered).toBe(false);
    const payload = result.payload as WeatherTaskPayload;
    expect(payload.status).toBe("error");
    expect(payload.message).toContain("timeout");
  });

  it("does not trigger when the task is not due yet, even with favorable forecast", async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.mocked(listTasksByEvent).mockResolvedValue([task({ lastDoneAt: today })]);
    vi.mocked(fetchForecast).mockResolvedValue(
      forecastFrom(today, [{ precip: 0, tempMax: 24, tempMin: 18 }]),
    );

    const result = await weatherTaskProvider.check(config, { eventId });

    expect(result.triggered).toBe(false);
    const payload = result.payload as WeatherTaskPayload;
    expect(payload.status).toBe("ok");
    expect(payload.recommendations).toHaveLength(0);
    expect(payload.tasks[0].due).toBe(false);
  });

  it("does not trigger when due but the forecast never satisfies the weather rules", async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.mocked(listTasksByEvent).mockResolvedValue([task({ lastDoneAt: null })]);
    vi.mocked(fetchForecast).mockResolvedValue(
      forecastFrom(today, [
        { precip: 10, tempMax: 24, tempMin: 18 }, // rainy every day
        { precip: 10, tempMax: 24, tempMin: 18 },
      ]),
    );

    const result = await weatherTaskProvider.check(config, { eventId });

    expect(result.triggered).toBe(false);
    const payload = result.payload as WeatherTaskPayload;
    expect(payload.recommendations).toHaveLength(0);
    expect(payload.tasks[0].due).toBe(true);
    expect(payload.tasks[0].triggered).toBe(false);
  });

  it("triggers with a recommendation when due and the forecast has a favorable window", async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.mocked(listTasksByEvent).mockResolvedValue([task({ lastDoneAt: null })]);
    vi.mocked(fetchForecast).mockResolvedValue(
      forecastFrom(today, [{ precip: 0, tempMax: 24, tempMin: 18 }]),
    );

    const result = await weatherTaskProvider.check(config, { eventId });

    expect(result.triggered).toBe(true);
    const payload = result.payload as WeatherTaskPayload;
    expect(payload.status).toBe("ok");
    expect(payload.recommendations).toHaveLength(1);
    expect(payload.recommendations[0].title).toBe("Покос травы");
    expect(payload.recommendations[0].reason).toContain("без дождя");
  });

  it("combines multiple due-and-favorable tasks into a single payload (one email, not one per task)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.mocked(listTasksByEvent).mockResolvedValue([
      task({ id: "task-1", title: "Покос травы", lastDoneAt: null }),
      task({ id: "task-2", title: "Фасадные работы", lastDoneAt: null, weatherRules: { minDryDaysInRow: 1 } }),
    ]);
    vi.mocked(fetchForecast).mockResolvedValue(
      forecastFrom(today, [{ precip: 0, tempMax: 24, tempMin: 18 }]),
    );

    const result = await weatherTaskProvider.check(config, { eventId });

    expect(result.triggered).toBe(true);
    const payload = result.payload as WeatherTaskPayload;
    expect(payload.recommendations).toHaveLength(2);
    expect(payload.recommendations.map((r) => r.title)).toEqual(["Покос травы", "Фасадные работы"]);
  });

  it("evaluates a workWindow task end-to-end using the hourly forecast", async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

    function fullDayHours(dateStr: string) {
      return Array.from({ length: 24 }, (_, h) => ({
        time: `${dateStr}T${String(h).padStart(2, "0")}:00`,
        temperatureC: 20,
        precipitationMm: 0,
        windSpeedKmh: 10,
      }));
    }

    vi.mocked(listTasksByEvent).mockResolvedValue([
      task({
        title: "Работа на лесах",
        intervalDays: 1,
        lastDoneAt: null,
        weatherRules: {
          kind: "workWindow",
          maxWindSpeedKmh: 30,
          minHours: 2,
          // Wide open on both weekday and weekend so the test isn't
          // time-of-day flaky.
          weekdayStartHour: 0,
          weekdayEndHour: 23,
          weekendStartHour: 0,
        },
      }),
    ]);
    vi.mocked(fetchForecast).mockResolvedValue({
      timezone: "UTC",
      // Two days of calm, dry, comfortable weather — today (unless it's
      // already past 23:00 UTC) or tomorrow will always have a >=2h window,
      // so this test isn't flaky near the day boundary.
      daily: [
        { date: today, precipitationMm: 0, tempMaxC: 20, tempMinC: 15, sunset: `${today}T23:30` },
        { date: tomorrow, precipitationMm: 0, tempMaxC: 20, tempMinC: 15, sunset: `${tomorrow}T23:30` },
      ],
      hourly: [...fullDayHours(today), ...fullDayHours(tomorrow)],
    });

    const result = await weatherTaskProvider.check(config, { eventId });

    expect(result.triggered).toBe(true);
    const payload = result.payload as WeatherTaskPayload;
    expect(payload.recommendations[0].reason).toContain("ч");
  });
});
