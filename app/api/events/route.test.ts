import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRow } from "@/lib/events/repository";

// Роуты тестируются на уровне HTTP-хендлеров с замоканным репозиторием
// (тонкой обёрткой над db-клиентом) — так тест проверяет валидацию,
// коды ответов и связку с реестром триггеров, не поднимая реальную БД.
vi.mock("@/lib/events/repository", () => ({
  listEvents: vi.fn(),
  createEvent: vi.fn(),
}));

const { listEvents, createEvent } = await import("@/lib/events/repository");
const { GET, POST } = await import("./route");

function makeEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
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

beforeEach(() => {
  vi.mocked(listEvents).mockReset();
  vi.mocked(createEvent).mockReset();
});

describe("GET /api/events", () => {
  it("returns the list of events", async () => {
    vi.mocked(listEvents).mockResolvedValue([makeEvent()]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].name).toBe("Test event");
  });
});

describe("POST /api/events", () => {
  function postRequest(body: unknown) {
    return new NextRequest("http://localhost/api/events", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  it("creates an event with a valid noop config", async () => {
    vi.mocked(createEvent).mockResolvedValue(makeEvent());

    const response = await POST(
      postRequest({
        name: "Test event",
        type: "noop",
        config: {},
        recipientEmail: "user@example.com",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.event.name).toBe("Test event");
    expect(createEvent).toHaveBeenCalledOnce();
  });

  it("rejects a missing recipientEmail with 400", async () => {
    const response = await POST(
      postRequest({
        name: "Test event",
        type: "noop",
        config: {},
      }),
    );

    expect(response.status).toBe(400);
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("rejects an unknown event type with 400", async () => {
    const response = await POST(
      postRequest({
        name: "Test event",
        type: "not_a_real_type",
        config: {},
        recipientEmail: "user@example.com",
      }),
    );

    expect(response.status).toBe(400);
    expect(createEvent).not.toHaveBeenCalled();
  });
});
