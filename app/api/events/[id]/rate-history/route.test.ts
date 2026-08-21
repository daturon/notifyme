import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRow } from "@/lib/events/repository";

vi.mock("@/lib/events/repository", () => ({
  getEventById: vi.fn(),
}));
vi.mock("@/lib/triggers/exchangeRate/repository", () => ({
  getRateHistorySeries: vi.fn(),
}));

const { getEventById } = await import("@/lib/events/repository");
const { getRateHistorySeries } = await import("@/lib/triggers/exchangeRate/repository");
const { GET } = await import("./route");

const eventId = "11111111-1111-1111-1111-111111111111";

function makeEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: eventId,
    name: "Test event",
    type: "exchange_rate",
    config: {},
    isActive: true,
    recipientEmail: "user@example.com",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.mocked(getEventById).mockReset();
  vi.mocked(getRateHistorySeries).mockReset();
});

describe("GET /api/events/:id/rate-history", () => {
  it("returns 404 when the event does not exist", async () => {
    vi.mocked(getEventById).mockResolvedValue(undefined);

    const response = await GET(
      new NextRequest(`http://localhost/api/events/${eventId}/rate-history`),
      params(eventId),
    );

    expect(response.status).toBe(404);
  });

  it("returns the series with the default limit", async () => {
    vi.mocked(getEventById).mockResolvedValue(makeEvent());
    vi.mocked(getRateHistorySeries).mockResolvedValue([
      { recordedAt: "2026-01-01", rate: 3.5, sourceName: "mtbank" },
    ]);

    const response = await GET(
      new NextRequest(`http://localhost/api/events/${eventId}/rate-history`),
      params(eventId),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.series).toHaveLength(1);
    expect(getRateHistorySeries).toHaveBeenCalledWith(eventId, 30);
  });

  it("respects a custom limit query param", async () => {
    vi.mocked(getEventById).mockResolvedValue(makeEvent());
    vi.mocked(getRateHistorySeries).mockResolvedValue([]);

    await GET(
      new NextRequest(`http://localhost/api/events/${eventId}/rate-history?limit=14`),
      params(eventId),
    );

    expect(getRateHistorySeries).toHaveBeenCalledWith(eventId, 14);
  });
});
