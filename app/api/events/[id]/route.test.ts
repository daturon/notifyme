import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRow } from "@/lib/events/repository";

vi.mock("@/lib/events/repository", () => ({
  getEventById: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));

const { getEventById, updateEvent, deleteEvent } = await import("@/lib/events/repository");
const { PUT, DELETE } = await import("./route");

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
  vi.mocked(updateEvent).mockReset();
  vi.mocked(deleteEvent).mockReset();
});

describe("PUT /api/events/:id", () => {
  function putRequest(body: unknown) {
    return new NextRequest(`http://localhost/api/events/${eventId}`, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  it("returns 404 when the event does not exist", async () => {
    vi.mocked(getEventById).mockResolvedValue(undefined);

    const response = await PUT(putRequest({ name: "New name" }), params(eventId));

    expect(response.status).toBe(404);
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("updates an existing event", async () => {
    vi.mocked(getEventById).mockResolvedValue(makeEvent());
    vi.mocked(updateEvent).mockResolvedValue(makeEvent({ name: "New name" }));

    const response = await PUT(putRequest({ name: "New name" }), params(eventId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.event.name).toBe("New name");
  });

  it("rejects an empty body with 400", async () => {
    vi.mocked(getEventById).mockResolvedValue(makeEvent());

    const response = await PUT(putRequest({}), params(eventId));

    expect(response.status).toBe(400);
    expect(updateEvent).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/events/:id", () => {
  it("returns 404 when the event does not exist", async () => {
    vi.mocked(deleteEvent).mockResolvedValue(false);

    const response = await DELETE(
      new NextRequest(`http://localhost/api/events/${eventId}`, { method: "DELETE" }),
      params(eventId),
    );

    expect(response.status).toBe(404);
  });

  it("deletes an existing event", async () => {
    vi.mocked(deleteEvent).mockResolvedValue(true);

    const response = await DELETE(
      new NextRequest(`http://localhost/api/events/${eventId}`, { method: "DELETE" }),
      params(eventId),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
