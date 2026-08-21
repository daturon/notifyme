import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRow } from "@/lib/events/repository";

vi.mock("@/lib/events/repository", () => ({
  getEventById: vi.fn(),
  getEventHistory: vi.fn(),
}));

const { getEventById, getEventHistory } = await import("@/lib/events/repository");
const { GET } = await import("./route");

const eventId = "11111111-1111-1111-1111-111111111111";

function makeEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: eventId,
    name: "Test event",
    type: "noop",
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
  vi.mocked(getEventHistory).mockReset();
});

describe("GET /api/events/:id/history", () => {
  it("returns 404 when the event does not exist", async () => {
    vi.mocked(getEventById).mockResolvedValue(undefined);

    const response = await GET(
      new NextRequest(`http://localhost/api/events/${eventId}/history`),
      params(eventId),
    );

    expect(response.status).toBe(404);
  });

  it("returns run_log and notification_log entries with the default limit", async () => {
    vi.mocked(getEventById).mockResolvedValue(makeEvent());
    vi.mocked(getEventHistory).mockResolvedValue({ runLog: [], notificationLog: [] });

    const response = await GET(
      new NextRequest(`http://localhost/api/events/${eventId}/history`),
      params(eventId),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ runLog: [], notificationLog: [] });
    expect(getEventHistory).toHaveBeenCalledWith(eventId, 20);
  });

  it("respects a custom limit query param", async () => {
    vi.mocked(getEventById).mockResolvedValue(makeEvent());
    vi.mocked(getEventHistory).mockResolvedValue({ runLog: [], notificationLog: [] });

    await GET(
      new NextRequest(`http://localhost/api/events/${eventId}/history?limit=5`),
      params(eventId),
    );

    expect(getEventHistory).toHaveBeenCalledWith(eventId, 5);
  });
});
