import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExchangeRatePayload } from "./index";

vi.mock("./fetchRates", () => ({ fetchAllRates: vi.fn() }));
vi.mock("./repository", () => ({
  upsertTodayRate: vi.fn(),
  getRateHistoryWindow: vi.fn(),
}));

const { fetchAllRates } = await import("./fetchRates");
const { upsertTodayRate, getRateHistoryWindow } = await import("./repository");
const { exchangeRateProvider } = await import("./index");
const { exchangeRateConfigSchema } = await import("./config");

const eventId = "11111111-1111-1111-1111-111111111111";

function fullWindow(rates: number[]) {
  return rates.map((rate, i) => ({
    recordedAt: `2026-01-${String(i + 1).padStart(2, "0")}`,
    rate,
    sourceName: "mtbank",
  }));
}

beforeEach(() => {
  vi.mocked(fetchAllRates).mockReset();
  vi.mocked(upsertTodayRate).mockReset().mockResolvedValue(undefined);
  vi.mocked(getRateHistoryWindow).mockReset();
});

describe("exchangeRateProvider.check", () => {
  it("does not throw and reports an error payload when every source fails", async () => {
    vi.mocked(fetchAllRates).mockResolvedValue({
      rates: [],
      failures: [{ source: "myfin.by", error: "timeout" }],
    });

    const config = exchangeRateConfigSchema.parse({});
    const result = await exchangeRateProvider.check(config, { eventId });

    expect(result.triggered).toBe(false);
    const payload = result.payload as ExchangeRatePayload;
    expect(payload.status).toBe("error");
    expect(payload.message).toContain("myfin.by");
    expect(upsertTodayRate).not.toHaveBeenCalled();
  });

  it("uses whatever succeeded when only some sources/banks are available", async () => {
    vi.mocked(fetchAllRates).mockResolvedValue({
      rates: [{ sourceId: "mtbank", label: "МТБанк", buyRatePer100: 3.4 }],
      failures: [{ source: "some-other-source", error: "HTTP 500" }],
    });
    vi.mocked(getRateHistoryWindow).mockResolvedValue(fullWindow([3.2]));

    const config = exchangeRateConfigSchema.parse({ sources: ["mtbank"], windowDays: 14 });
    const result = await exchangeRateProvider.check(config, { eventId });

    expect(upsertTodayRate).toHaveBeenCalledWith(
      expect.objectContaining({ eventId, sourceName: "mtbank", rate: 3.4 }),
    );
    const payload = result.payload as ExchangeRatePayload;
    expect(payload.status).toBe("insufficient_history");
    expect(payload.sourceFailures).toEqual([{ source: "some-other-source", error: "HTTP 500" }]);
  });

  it("reports insufficient history and does not trigger when fewer than windowDays points exist", async () => {
    vi.mocked(fetchAllRates).mockResolvedValue({
      rates: [{ sourceId: "mtbank", label: "МТБанк", buyRatePer100: 3.5 }],
      failures: [],
    });
    vi.mocked(getRateHistoryWindow).mockResolvedValue(fullWindow([3.4, 3.5]));

    const config = exchangeRateConfigSchema.parse({ sources: ["mtbank"], windowDays: 14 });
    const result = await exchangeRateProvider.check(config, { eventId });

    expect(result.triggered).toBe(false);
    const payload = result.payload as ExchangeRatePayload;
    expect(payload.status).toBe("insufficient_history");
    expect(payload.stats.accumulatedDays).toBe(2);
    expect(payload.message).toContain("2 из 14");
  });

  it("triggers when today's best rate is the 14-day max and clears the threshold", async () => {
    vi.mocked(fetchAllRates).mockResolvedValue({
      rates: [{ sourceId: "mtbank", label: "МТБанк", buyRatePer100: 3.6 }],
      failures: [],
    });
    const window = fullWindow([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3.6]);
    vi.mocked(getRateHistoryWindow).mockResolvedValue(window);

    const config = exchangeRateConfigSchema.parse({ sources: ["mtbank"], windowDays: 14, thresholdPercent: 0.01 });
    const result = await exchangeRateProvider.check(config, { eventId });

    expect(result.triggered).toBe(true);
    const payload = result.payload as ExchangeRatePayload;
    expect(payload.status).toBe("ok");
    expect(payload.isWindowMax).toBe(true);
    expect(payload.message).toContain("МТБанк");
  });
});
