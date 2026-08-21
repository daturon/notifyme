import { describe, expect, it } from "vitest";
import { computeTrend, computeWindowStats, evaluateTrigger, type RatePoint } from "./logic";

function points(rates: number[], startDate = "2026-01-01"): RatePoint[] {
  const start = new Date(startDate);
  return rates.map((rate, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return { recordedAt: d.toISOString().slice(0, 10), rate, sourceName: "mtbank" };
  });
}

describe("computeWindowStats", () => {
  it("is insufficient when fewer than requiredDays points are available", () => {
    const stats = computeWindowStats(points([3.1, 3.2, 3.3]), 14);

    expect(stats.sufficient).toBe(false);
    expect(stats.accumulatedDays).toBe(3);
    expect(stats.requiredDays).toBe(14);
    expect(stats.average).toBeUndefined();
    expect(stats.max).toBeUndefined();
  });

  it("computes average and max over exactly requiredDays points", () => {
    const rates = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3.6]; // 14 points
    const stats = computeWindowStats(points(rates), 14);

    expect(stats.sufficient).toBe(true);
    expect(stats.accumulatedDays).toBe(14);
    expect(stats.max).toBe(3.6);
    expect(stats.average).toBeCloseTo((13 * 3 + 3.6) / 14, 10);
  });
});

describe("evaluateTrigger", () => {
  it("triggers when today is the window max and exceeds average by the threshold", () => {
    const window = points([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3.5]); // avg ~3.036, max 3.5
    const stats = computeWindowStats(window, 14);

    const evaluation = evaluateTrigger(3.5, stats, 0.01);

    expect(evaluation.isWindowMax).toBe(true);
    expect(evaluation.exceedsThreshold).toBe(true);
    expect(evaluation.triggered).toBe(true);
  });

  it("does not trigger when today equals the window max but stays under the average+threshold", () => {
    // Flat history: today equals max (it's part of the window), but is not
    // 1% above a nearly-identical average — boundary case from the task.
    const window = points([3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5]);
    const stats = computeWindowStats(window, 14);

    const evaluation = evaluateTrigger(3.5, stats, 0.01);

    expect(evaluation.isWindowMax).toBe(true);
    expect(evaluation.exceedsThreshold).toBe(false);
    expect(evaluation.triggered).toBe(false);
  });

  it("does not trigger when today is below the window max", () => {
    const window = points([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4]);
    const stats = computeWindowStats(window, 14);

    const evaluation = evaluateTrigger(3, stats, 0.01);

    expect(evaluation.isWindowMax).toBe(false);
    expect(evaluation.triggered).toBe(false);
  });

  it("never triggers when the window is insufficient, regardless of today's rate", () => {
    const stats = computeWindowStats(points([3, 3.5]), 14);

    const evaluation = evaluateTrigger(3.5, stats, 0.01);

    expect(evaluation.triggered).toBe(false);
  });

  it("handles several days tied at the same max — the most recent still counts as window max", () => {
    const window = points([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3.6, 3.6, 3.6]);
    const stats = computeWindowStats(window, 14);

    const evaluation = evaluateTrigger(3.6, stats, 0.01);

    expect(stats.max).toBe(3.6);
    expect(evaluation.isWindowMax).toBe(true);
    expect(evaluation.triggered).toBe(true);
  });
});

describe("computeTrend", () => {
  it("is unknown with fewer than 3 points", () => {
    expect(computeTrend(points([3, 3.1]))).toBe("unknown");
  });

  it("is up when both of the last two day-over-day deltas are positive", () => {
    expect(computeTrend(points([3, 3.1, 3.2]))).toBe("up");
  });

  it("is down when both of the last two day-over-day deltas are negative", () => {
    expect(computeTrend(points([3.3, 3.2, 3.1]))).toBe("down");
  });

  it("is flat when the deltas don't agree in sign", () => {
    expect(computeTrend(points([3.1, 3.3, 3.2]))).toBe("flat");
  });

  it("is flat across several days tied at the same rate", () => {
    expect(computeTrend(points([3.5, 3.5, 3.5]))).toBe("flat");
  });
});
