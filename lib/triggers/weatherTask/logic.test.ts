import { describe, expect, it } from "vitest";
import {
  buildReason,
  buildWorkWindowReason,
  evaluateTask,
  findFavorableWindow,
  findLongestFavorableRun,
  isDayFavorable,
  isHourFavorable,
  isTaskDue,
  type FavorableWindow,
  type FavorableWorkWindow,
} from "./logic";
import type { DailyForecast, ForecastData, HourlyForecast } from "./openMeteo";
import type { DailyWeatherRules, WorkWindowRules } from "./taskRules";

const TZ = "Europe/Minsk";

function day(
  date: string,
  precipitationMm: number,
  tempMaxC: number,
  tempMinC: number,
  sunset = `${date}T21:00`,
): DailyForecast {
  return { date, precipitationMm, tempMaxC, tempMinC, sunset };
}

function hour(time: string, precipitationMm: number, temperatureC: number, windSpeedKmh: number): HourlyForecast {
  return { time, precipitationMm, temperatureC, windSpeedKmh };
}

function dailyRules(overrides: Partial<DailyWeatherRules> = {}): DailyWeatherRules {
  return { kind: "daily", minDryDaysInRow: 1, ...overrides };
}

function workWindowRules(overrides: Partial<WorkWindowRules> = {}): WorkWindowRules {
  return {
    kind: "workWindow",
    maxWindSpeedKmh: 30,
    minHours: 2,
    weekdayStartHour: 8,
    weekdayEndHour: 18,
    weekendStartHour: 8,
    ...overrides,
  };
}

function forecastData(daily: DailyForecast[], hourly: HourlyForecast[], timezone = TZ): ForecastData {
  return { timezone, daily, hourly };
}

describe("isDayFavorable", () => {
  it("rejects a rainy day regardless of temperature", () => {
    expect(isDayFavorable(day("2026-06-01", 5, 20, 10), dailyRules())).toBe(false);
  });

  it("accepts a dry day with no temperature constraints", () => {
    expect(isDayFavorable(day("2026-06-01", 0, 20, 10), dailyRules())).toBe(true);
  });

  it("treats trace precipitation as dry", () => {
    expect(isDayFavorable(day("2026-06-01", 0.3, 20, 10), dailyRules())).toBe(true);
  });

  it("rejects a dry day below minTempC", () => {
    expect(isDayFavorable(day("2026-06-01", 0, 8, 2), dailyRules({ minTempC: 12 }))).toBe(false);
  });

  it("rejects a dry day above maxTempC", () => {
    expect(isDayFavorable(day("2026-06-01", 0, 34, 30), dailyRules({ maxTempC: 28 }))).toBe(false);
  });

  it("accepts a dry day within the temperature range (mean of max/min)", () => {
    expect(isDayFavorable(day("2026-06-01", 0, 26, 18), dailyRules({ minTempC: 12, maxTempC: 28 }))).toBe(true);
  });
});

describe("findFavorableWindow", () => {
  it("returns null when no window of the required length exists", () => {
    const forecast = [day("2026-06-01", 0, 20, 10), day("2026-06-02", 5, 20, 10), day("2026-06-03", 0, 20, 10)];
    expect(findFavorableWindow(forecast, dailyRules({ minDryDaysInRow: 2 }))).toBeNull();
  });

  it("finds the earliest window of consecutive dry days matching the temperature range", () => {
    const forecast = [
      day("2026-06-01", 5, 20, 10),
      day("2026-06-02", 0, 24, 20),
      day("2026-06-03", 0, 26, 22),
      day("2026-06-04", 0, 28, 24),
    ];
    const window = findFavorableWindow(forecast, dailyRules({ minDryDaysInRow: 3, minTempC: 15, maxTempC: 30 }));

    expect(window).not.toBeNull();
    expect(window?.startDate).toBe("2026-06-02");
    expect(window?.endDate).toBe("2026-06-04");
    expect(window?.days).toBe(3);
  });

  it("computes min/max mean temperature actually observed in the window", () => {
    const forecast = [day("2026-06-01", 0, 22, 18), day("2026-06-02", 0, 30, 26)];
    const window = findFavorableWindow(forecast, dailyRules({ minDryDaysInRow: 2 }));

    expect(window?.minTempC).toBe(20);
    expect(window?.maxTempC).toBe(28);
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

describe("evaluateTask (daily kind)", () => {
  const forecast = forecastData(
    [day("2026-06-15", 0, 26, 20), day("2026-06-16", 0, 27, 21)],
    [],
  );

  it("does not trigger when the task is not yet due, even with favorable weather", () => {
    const evaluation = evaluateTask({
      lastDoneAt: "2026-06-10",
      intervalDays: 14,
      weatherRules: dailyRules({ minTempC: 12, maxTempC: 28 }),
      forecast,
      today: "2026-06-15",
      now: new Date("2026-06-15T08:00:00Z"),
    });

    expect(evaluation.due).toBe(false);
    expect(evaluation.triggered).toBe(false);
  });

  it("triggers with a reason when due and the weather window matches", () => {
    const evaluation = evaluateTask({
      lastDoneAt: "2026-06-01",
      intervalDays: 14,
      weatherRules: dailyRules({ minDryDaysInRow: 2, minTempC: 12, maxTempC: 28 }),
      forecast,
      today: "2026-06-15",
      now: new Date("2026-06-15T08:00:00Z"),
    });

    expect(evaluation.triggered).toBe(true);
    expect(evaluation.reason).toContain("без дождя");
  });
});

// --- workWindow (hourly) logic ---------------------------------------------

describe("isHourFavorable", () => {
  it("rejects a windy hour", () => {
    expect(isHourFavorable(hour("2026-06-15T10:00", 0, 20, 40), workWindowRules({ maxWindSpeedKmh: 30 }))).toBe(
      false,
    );
  });

  it("rejects a rainy hour", () => {
    expect(isHourFavorable(hour("2026-06-15T10:00", 1, 20, 5), workWindowRules())).toBe(false);
  });

  it("accepts a calm, dry, comfortable hour", () => {
    expect(isHourFavorable(hour("2026-06-15T10:00", 0, 20, 10), workWindowRules({ minTempC: 5, maxTempC: 30 }))).toBe(
      true,
    );
  });

  it("rejects an hour outside the temperature range", () => {
    expect(isHourFavorable(hour("2026-06-15T10:00", 0, 2, 10), workWindowRules({ minTempC: 5 }))).toBe(false);
  });
});

describe("findLongestFavorableRun", () => {
  it("returns null when no hour is favorable", () => {
    const hours = [hour("2026-06-15T10:00", 5, 20, 10), hour("2026-06-15T11:00", 5, 20, 10)];
    expect(findLongestFavorableRun(hours, workWindowRules())).toBeNull();
  });

  it("finds the longest of several separated runs", () => {
    const hours = [
      hour("2026-06-15T08:00", 0, 20, 10), // 1-hour run
      hour("2026-06-15T09:00", 5, 20, 10), // rain breaks it
      hour("2026-06-15T10:00", 0, 20, 10), // 3-hour run starts
      hour("2026-06-15T11:00", 0, 20, 10),
      hour("2026-06-15T12:00", 0, 20, 10),
      hour("2026-06-15T13:00", 5, 20, 10),
    ];
    const run = findLongestFavorableRun(hours, workWindowRules());

    expect(run).not.toBeNull();
    expect(run?.hours).toBe(3);
    expect(run?.startTime).toBe("2026-06-15T10:00");
    expect(run?.endTime).toBe("2026-06-15T13:00"); // exclusive end = one hour past the last favorable slot
  });
});

describe("buildWorkWindowReason", () => {
  it("mentions today, the clock range and duration", () => {
    const window: FavorableWorkWindow = {
      date: "2026-06-15",
      startTime: "2026-06-15T14:00",
      endTime: "2026-06-15T18:00",
      hours: 4,
    };
    const reason = buildWorkWindowReason(window, true, "2026-06-15T18:00");
    expect(reason).toContain("сегодня");
    expect(reason).toContain("с 14:00 до 18:00");
    expect(reason).toContain("~4 ч");
  });
});

describe("evaluateTask (workWindow kind)", () => {
  it("does not trigger when the task is not due", () => {
    const forecast = forecastData(
      [day("2026-06-15", 0, 26, 20)],
      [hour("2026-06-15T10:00", 0, 20, 10), hour("2026-06-15T11:00", 0, 20, 10), hour("2026-06-15T12:00", 0, 20, 10)],
    );

    const evaluation = evaluateTask({
      lastDoneAt: "2026-06-15",
      intervalDays: 1,
      weatherRules: workWindowRules({ minHours: 2 }),
      forecast,
      today: "2026-06-15",
      now: new Date("2026-06-15T05:00:00Z"),
    });

    expect(evaluation.due).toBe(false);
    expect(evaluation.triggered).toBe(false);
  });

  it("does not trigger when due but no run reaches minHours before the weekday cutoff", () => {
    // Monday 2026-06-15. Weekday cutoff 18:00, only a 1-hour calm window.
    const forecast = forecastData(
      [day("2026-06-15", 0, 22, 18, "2026-06-15T21:30")],
      [
        hour("2026-06-15T15:00", 0, 20, 40), // windy
        hour("2026-06-15T16:00", 0, 20, 10), // calm — only 1 hour
        hour("2026-06-15T17:00", 0, 20, 40), // windy again
      ],
    );

    const evaluation = evaluateTask({
      lastDoneAt: null,
      intervalDays: 1,
      weatherRules: workWindowRules({ minHours: 2, weekdayEndHour: 18 }),
      forecast,
      today: "2026-06-15",
      now: new Date("2026-06-15T12:00:00+03:00"),
    });

    expect(evaluation.due).toBe(true);
    expect(evaluation.triggered).toBe(false);
  });

  it("triggers and estimates hours for a favorable window capped by the weekday 18:00 cutoff", () => {
    // Monday 2026-06-15, sunset well after 18:00 — the weekday cutoff binds.
    const forecast = forecastData(
      [day("2026-06-15", 0, 22, 18, "2026-06-15T21:30")],
      [
        hour("2026-06-15T14:00", 0, 20, 10),
        hour("2026-06-15T15:00", 0, 21, 10),
        hour("2026-06-15T16:00", 0, 21, 10),
        hour("2026-06-15T17:00", 0, 20, 10),
        hour("2026-06-15T18:00", 0, 20, 10), // at/after cutoff, excluded
      ],
    );

    const evaluation = evaluateTask({
      lastDoneAt: null,
      intervalDays: 1,
      weatherRules: workWindowRules({ minHours: 2, weekdayEndHour: 18, minTempC: 5, maxTempC: 30 }),
      forecast,
      today: "2026-06-15",
      now: new Date("2026-06-15T10:00:00+03:00"), // well before 14:00 local
    });

    expect(evaluation.triggered).toBe(true);
    const window = evaluation.window as FavorableWorkWindow;
    expect(window.hours).toBe(4);
    expect(window.endTime).toBe("2026-06-15T18:00"); // capped, not 19:00
    expect(evaluation.reason).toContain("~4 ч");
  });

  it("caps the window by sunset on a weekend instead of the weekday hour", () => {
    // 2026-06-20 is a Saturday. Sunset at 20:00, well past weekdayEndHour (18:00),
    // which must NOT apply on weekends.
    const forecast = forecastData(
      [day("2026-06-20", 0, 24, 18, "2026-06-20T20:00")],
      [
        hour("2026-06-20T18:00", 0, 22, 10),
        hour("2026-06-20T19:00", 0, 22, 10),
        hour("2026-06-20T20:00", 0, 22, 10), // at sunset, excluded
      ],
    );

    const evaluation = evaluateTask({
      lastDoneAt: null,
      intervalDays: 1,
      weatherRules: workWindowRules({ minHours: 2, weekdayEndHour: 18 }),
      forecast,
      today: "2026-06-20",
      now: new Date("2026-06-20T10:00:00+03:00"),
    });

    expect(evaluation.triggered).toBe(true);
    const window = evaluation.window as FavorableWorkWindow;
    expect(window.hours).toBe(2);
    expect(window.endTime).toBe("2026-06-20T20:00");
  });

  it("starts the window from the current hour today, not dayStartHour", () => {
    const forecast = forecastData(
      [day("2026-06-15", 0, 24, 18, "2026-06-15T21:30")],
      [
        hour("2026-06-15T09:00", 0, 20, 10), // before "now" — must be excluded
        hour("2026-06-15T10:00", 0, 20, 10),
        hour("2026-06-15T11:00", 0, 20, 10),
      ],
    );

    const evaluation = evaluateTask({
      lastDoneAt: null,
      intervalDays: 1,
      weatherRules: workWindowRules({ minHours: 2 }),
      forecast,
      today: "2026-06-15",
      now: new Date("2026-06-15T09:30:00+03:00"), // 09:30 local — 09:00 slot already past
    });

    expect(evaluation.triggered).toBe(true);
    const window = evaluation.window as FavorableWorkWindow;
    expect(window.startTime).toBe("2026-06-15T10:00");
    expect(window.hours).toBe(2);
  });

  it("looks ahead to the next day when today has no usable window left", () => {
    const forecast = forecastData(
      [
        day("2026-06-15", 0, 24, 18, "2026-06-15T21:30"),
        day("2026-06-16", 0, 24, 18, "2026-06-16T21:30"),
      ],
      [hour("2026-06-16T10:00", 0, 20, 10), hour("2026-06-16T11:00", 0, 20, 10)],
    );

    const evaluation = evaluateTask({
      lastDoneAt: null,
      intervalDays: 1,
      weatherRules: workWindowRules({ minHours: 2, weekdayEndHour: 18 }),
      forecast,
      today: "2026-06-15",
      now: new Date("2026-06-15T22:00:00+03:00"), // past today's cutoff already
    });

    expect(evaluation.triggered).toBe(true);
    const window = evaluation.window as FavorableWorkWindow;
    expect(window.date).toBe("2026-06-16");
  });

  it("uses weekdayStartHour, not weekendStartHour, as the weekday lower bound (evening-only availability)", () => {
    // User scenario: available weekdays only 18:00-21:00 (after work), calm
    // and dry hour at 09:00 must NOT count even though it satisfies the
    // weather rules — it's before the weekday window opens.
    const forecast = forecastData(
      [day("2026-06-15", 0, 22, 16, "2026-06-15T21:30")], // Monday
      [
        hour("2026-06-15T09:00", 0, 18, 5), // calm and dry, but too early
        hour("2026-06-15T19:00", 0, 18, 5),
        hour("2026-06-15T20:00", 0, 18, 5),
      ],
    );

    const evaluation = evaluateTask({
      lastDoneAt: null,
      intervalDays: 1,
      weatherRules: workWindowRules({ minHours: 2, weekdayStartHour: 18, weekdayEndHour: 21 }),
      forecast,
      today: "2026-06-15",
      now: new Date("2026-06-15T07:00:00+03:00"), // before the window opens
    });

    expect(evaluation.triggered).toBe(true);
    const window = evaluation.window as FavorableWorkWindow;
    expect(window.startTime).toBe("2026-06-15T19:00");
    expect(window.endTime).toBe("2026-06-15T21:00");
    expect(window.hours).toBe(2);
  });
});
