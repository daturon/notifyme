import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRow } from "@/lib/events/repository";

vi.mock("@/lib/events/repository", () => ({
  listActiveEvents: vi.fn(),
  insertRunLog: vi.fn(),
}));
vi.mock("@/lib/notifications/engine", () => ({ notifyIfNeeded: vi.fn() }));
vi.mock("@/lib/triggers/registry", () => ({ getProvider: vi.fn() }));

const { listActiveEvents, insertRunLog } = await import("@/lib/events/repository");
const { notifyIfNeeded } = await import("@/lib/notifications/engine");
const { getProvider } = await import("@/lib/triggers/registry");
const { GET, POST } = await import("./route");

function makeEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "event-1",
    name: "Event 1",
    type: "noop",
    config: {},
    isActive: true,
    recipientEmail: "user@example.com",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function cronRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/cron/run", { headers });
}

beforeEach(() => {
  vi.mocked(listActiveEvents).mockReset();
  vi.mocked(insertRunLog).mockReset();
  vi.mocked(notifyIfNeeded).mockReset();
  vi.mocked(getProvider).mockReset();
  process.env.CRON_SECRET = "test-secret";
});

describe("GET/POST /api/cron/run", () => {
  it("rejects requests without a matching Authorization header", async () => {
    const response = await GET(cronRequest());
    expect(response.status).toBe(401);
    expect(listActiveEvents).not.toHaveBeenCalled();
  });

  it("rejects requests with the wrong secret", async () => {
    const response = await GET(cronRequest({ authorization: "Bearer wrong" }));
    expect(response.status).toBe(401);
  });

  it("rejects all requests when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(cronRequest({ authorization: "Bearer undefined" }));
    expect(response.status).toBe(401);
  });

  it("processes all active events and returns a summary", async () => {
    const eventA = makeEvent({ id: "a", name: "A" });
    const eventB = makeEvent({ id: "b", name: "B" });
    vi.mocked(listActiveEvents).mockResolvedValue([eventA, eventB]);
    vi.mocked(getProvider).mockReturnValue({
      type: "noop",
      configSchema: { parse: (v: unknown) => v } as never,
      check: vi.fn().mockResolvedValue({ triggered: true, payload: { x: 1 } }),
    });
    vi.mocked(insertRunLog).mockResolvedValue({
      id: "log",
      eventId: "a",
      ranAt: new Date(),
      triggered: true,
      rawResult: null,
    });
    vi.mocked(notifyIfNeeded).mockResolvedValue({ status: "sent" });

    const response = await POST(cronRequest({ authorization: "Bearer test-secret" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checked).toBe(2);
    expect(body.triggered).toBe(2);
    expect(body.sent).toBe(2);
    expect(body.errors).toEqual([]);
    expect(body.results).toHaveLength(2);
  });

  it("keeps processing the remaining events when one event throws", async () => {
    const eventA = makeEvent({ id: "a", name: "A" });
    const eventB = makeEvent({ id: "b", name: "B" });
    vi.mocked(listActiveEvents).mockResolvedValue([eventA, eventB]);
    vi.mocked(getProvider)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({
        type: "noop",
        configSchema: { parse: (v: unknown) => v } as never,
        check: vi.fn().mockResolvedValue({ triggered: false, payload: null }),
      });
    vi.mocked(insertRunLog).mockResolvedValue({
      id: "log",
      eventId: "b",
      ranAt: new Date(),
      triggered: false,
      rawResult: null,
    });
    vi.mocked(notifyIfNeeded).mockResolvedValue({ status: "not_triggered" });

    const response = await POST(cronRequest({ authorization: "Bearer test-secret" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checked).toBe(2);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].eventId).toBe("a");
    expect(body.results).toHaveLength(1);
    expect(body.results[0].eventId).toBe("b");
  });
});
