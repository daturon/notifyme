import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRow } from "@/lib/events/repository";

vi.mock("@/lib/events/repository", () => ({ getEventById: vi.fn() }));
vi.mock("@/lib/notifications/engine", () => ({ sendTestEmail: vi.fn() }));

const { getEventById } = await import("@/lib/events/repository");
const { sendTestEmail } = await import("@/lib/notifications/engine");
const { POST } = await import("./route");

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
  vi.mocked(sendTestEmail).mockReset();
});

describe("POST /api/events/:id/send-test", () => {
  it("returns 404 when the event does not exist", async () => {
    vi.mocked(getEventById).mockResolvedValue(undefined);

    const response = await POST(
      new NextRequest(`http://localhost/api/events/${eventId}/send-test`, { method: "POST" }),
      params(eventId),
    );

    expect(response.status).toBe(404);
    expect(sendTestEmail).not.toHaveBeenCalled();
  });

  it("sends a test email and returns success", async () => {
    vi.mocked(getEventById).mockResolvedValue(makeEvent());
    vi.mocked(sendTestEmail).mockResolvedValue(undefined);

    const response = await POST(
      new NextRequest(`http://localhost/api/events/${eventId}/send-test`, { method: "POST" }),
      params(eventId),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(sendTestEmail).toHaveBeenCalledWith(makeEvent());
  });

  it("returns 502 with the underlying error message when sending fails", async () => {
    vi.mocked(getEventById).mockResolvedValue(makeEvent());
    vi.mocked(sendTestEmail).mockRejectedValue(new Error("bad api key"));

    const response = await POST(
      new NextRequest(`http://localhost/api/events/${eventId}/send-test`, { method: "POST" }),
      params(eventId),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("bad api key");
  });
});
