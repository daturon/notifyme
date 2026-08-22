import { describe, expect, it } from "vitest";
import {
  buildReason,
  evaluateTask,
  findFavorableWindow,
  isDayFavorable,
  isTaskDue,
  type FavorableWindow,
} from "./logic";
import type { DailyForecast } from "./openMeteo";
import type { WeatherRules } from "./taskRules";

function day(date: string, precipitationMm: number, tempMaxC: number, tempMinC: number): DailyForecast {
  return { date, precipitationMm, tempMaxC, tempMinC };
}

function rules(overrides: Partial<WeatherRules> = {}): WeatherRules {
  return { minDryDaysInRow: 1, ...overrides };
}

describe("isDayFavorable", () => {
  it("rejects a rainy day regardless of temperature", () => {
    expect(isDayFavorable(day("2026-06-01", 5, 20, 10), rules())).toBe(false);
  });

  it("accepts a dry day with no temperature constraints", () => {
    expect(isDayFavorable(day("2026-06-01", 0, 20, 10), rules())).toBe(true);
  });

  it("treats trace precipitation as dry", () => {
    expect(isDayFavorable(day("2026-06-01", 0.3, 20, 10), rules())).toBe(true);
  });

  it("rejects a dry day below minTempC", () => {
    expect(isDayFavorable(day("2026-06-01", 0, 8, 2), rules({ minTempC: 12 }))).toBe(false);
  });

  it("rejects a dry day above maxTempC", () => {
    expect(isDayFavorable(day("2026-06-01", 0, 34, 30), rules({ maxTempC: 28 }))).toBe(false);
  });

  it("accepts a dry day within the temperature range (mean of max/min)", () => {
    expect(isDayFavorable(day("2026-06-01", 0, 26, 18), rules({ minTempC: 12, maxTempC: 28 }))).toBe(true);
  });
});

describe("findFavorableWindow", () => {
  it("returns null when no window of the required length exists", () => {
    const forecast = [
      day("2026-06-01", 0, 20, 10),
      day("2026-06-02", 5, 20, 10), // rain breaks the streak
      day("2026-06-03", 0, 20, 10),
    ];
    expect(findFavorableWindow(forecast, rules({ minDryDaysInRow: 2 }))).toBeNull();
  });

  it("finds the earliest window of consecutive dry days matching the temperature range", () => {
    const forecast = [
      day("2026-06-01", 5, 20, 10), // rainy, excluded
      day("2026-06-02", 0, 24, 20), // window start
      day("2026-06-03", 0, 26, 22),
      day("2026-06-04", 0, 28, 24),
    ];
    const window = findFavorableWindow(forecast, rules({ minDryDaysInRow: 3, minTempC: 15, maxTempC: 30 }));

    expect(window).not.toBeNull();
    expect(window?.startDate).toBe("2026-06-02");
    expect(window?.endDate).toBe("2026-06-04");
    expect(window?.days).toBe(3);
  });

  it("requires all days in the window to satisfy the temperature range, not just some", () => {
    const forecast = [
      day("2026-06-01", 0, 26, 22), // ok
      day("2026-06-02", 0, 5, 0), // too cold, breaks a 2-day window starting here
      day("2026-06-03", 0, 26, 22),
      day("2026-06-04", 0, 26, 22),
    ];
    const window = findFavorableWindow(forecast, rules({ minDryDaysInRow: 2, minTempC: 15, maxTempC: 30 }));

    expect(window?.startDate).toBe("2026-06-03");
  });

  it("computes min/max mean temperature actually observed in the window", () => {
    const forecast = [day("2026-06-01", 0, 22, 18), day("2026-06-02", 0, 30, 26)];
    const window = findFavorableWindow(forecast, rules({ minDryDaysInRow: 2 }));

    expect(window?.minTempC).toBe(20); // mean of day 1: (22+18)/2
    expect(window?.maxTempC).toBe(28); // mean of day 2: (30+26)/2
  });
});

describe("isTaskDue", () => {
  it("is due when the task has never been done", () => {
    expect(isTaskDue(null, 14, "2026-06-15")).toBe(true);
  });

  it("is not due when fewer than intervalDays have passed", () => {
    expect(isTaskDue("2026-06-05", 14, "2026-06-15")).toBe(false);
  });

  it("is due exactly on the interval boundary", () => {
    expect(isTaskDue("2026-06-01", 14, "2026-06-15")).toBe(true);
  });

  it("is due when more than intervalDays have passed", () => {
    expect(isTaskDue("2026-01-01", 14, "2026-06-15")).toBe(true);
  });
});

describe("buildReason", () => {
  it("formats a multi-day window with the date range and temperature", () => {
    const window: FavorableWindow = {
      startDate: "2026-06-03",
      endDate: "2026-06-05",
      days: 3,
      minTempC: 22,
      maxTempC: 26,
    };
    expect(buildReason(window)).toBe("благоприятное окно 3 дня без дождя, 22–26°C (с 03.06)");
  });
});

describe("evaluateTask", () => {
  const forecast = [
    day("2026-06-15", 0, 26, 20), // favorable
    day("2026-06-16", 0, 27, 21),
  ];

  it("does not trigger when the task is not yet due, even with favorable weather", () => {
    const evaluation = evaluateTask({
      lastDoneAt: "2026-06-10",
      intervalDays: 14,
      weatherRules: rules({ minTempC: 12, maxTempC: 28 }),
      forecast,
      today: "2026-06-15",
    });

    expect(evaluation.due).toBe(false);
    expect(evaluation.triggered).toBe(false);
    expect(evaluation.reason).toBeNull();
  });

  it("does not trigger when due but no favorable window exists in the forecast", () => {
    const evaluation = evaluateTask({
      lastDoneAt: "2026-06-01",
      intervalDays: 14,
      weatherRules: rules({ minTempC: 30 }), // forecast never reaches 30
      forecast,
      today: "2026-06-15",
    });

    expect(evaluation.due).toBe(true);
    expect(evaluation.triggered).toBe(false);
    expect(evaluation.window).toBeNull();
  });

  it("triggers with a reason when due and the weather window matches", () => {
    const evaluation = evaluateTask({
      lastDoneAt: "2026-06-01",
      intervalDays: 14,
      weatherRules: rules({ minDryDaysInRow: 2, minTempC: 12, maxTempC: 28 }),
      forecast,
      today: "2026-06-15",
    });

    expect(evaluation.due).toBe(true);
    expect(evaluation.triggered).toBe(true);
    expect(evaluation.reason).toContain("без дождя");
  });

  it("triggers for a task that has never been done, given favorable weather", () => {
    const evaluation = evaluateTask({
      lastDoneAt: null,
      intervalDays: 14,
      weatherRules: rules(),
      forecast,
      today: "2026-06-15",
    });

    expect(evaluation.triggered).toBe(true);
  });
});
