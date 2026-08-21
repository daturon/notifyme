import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRow } from "@/lib/events/repository";

vi.mock("@/lib/events/repository", () => ({
  hasSentNotificationToday: vi.fn(),
  insertNotificationLog: vi.fn(),
}));
vi.mock("./resend", () => ({ sendEmail: vi.fn() }));

const { hasSentNotificationToday, insertNotificationLog } = await import("@/lib/events/repository");
const { sendEmail } = await import("./resend");
const { notifyIfNeeded, sendTestEmail } = await import("./engine");

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
  vi.mocked(hasSentNotificationToday).mockReset();
  vi.mocked(insertNotificationLog).mockReset();
  vi.mocked(sendEmail).mockReset();
});

describe("notifyIfNeeded", () => {
  it("does nothing when the trigger did not fire", async () => {
    const outcome = await notifyIfNeeded(makeEvent(), { triggered: false, payload: null });

    expect(outcome).toEqual({ status: "not_triggered" });
    expect(hasSentNotificationToday).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips sending when a notification was already sent today", async () => {
    vi.mocked(hasSentNotificationToday).mockResolvedValue(true);

    const outcome = await notifyIfNeeded(makeEvent(), { triggered: true, payload: { foo: "bar" } });

    expect(outcome).toEqual({ status: "already_sent_today" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends the email and logs success", async () => {
    vi.mocked(hasSentNotificationToday).mockResolvedValue(false);
    vi.mocked(sendEmail).mockResolvedValue(undefined);
    vi.mocked(insertNotificationLog).mockResolvedValue({
      id: "log-1",
      eventId: "11111111-1111-1111-1111-111111111111",
      sentAt: new Date(),
      subject: "subject",
      body: "body",
      status: "sent",
    });

    const outcome = await notifyIfNeeded(makeEvent(), { triggered: true, payload: { foo: "bar" } });

    expect(outcome).toEqual({ status: "sent" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(insertNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: makeEvent().id, status: "sent" }),
    );
  });

  it("retries once on send failure, then logs failed without throwing", async () => {
    vi.mocked(hasSentNotificationToday).mockResolvedValue(false);
    vi.mocked(sendEmail).mockRejectedValue(new Error("resend down"));
    vi.mocked(insertNotificationLog).mockResolvedValue({
      id: "log-1",
      eventId: "11111111-1111-1111-1111-111111111111",
      sentAt: new Date(),
      subject: "subject",
      body: "body",
      status: "failed",
    });

    const outcome = await notifyIfNeeded(makeEvent(), { triggered: true, payload: { foo: "bar" } });

    expect(outcome).toEqual({ status: "failed", error: "resend down" });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(insertNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("succeeds on the retry after one failed attempt", async () => {
    vi.mocked(hasSentNotificationToday).mockResolvedValue(false);
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("transient")).mockResolvedValueOnce(undefined);
    vi.mocked(insertNotificationLog).mockResolvedValue({
      id: "log-1",
      eventId: "11111111-1111-1111-1111-111111111111",
      sentAt: new Date(),
      subject: "subject",
      body: "body",
      status: "sent",
    });

    const outcome = await notifyIfNeeded(makeEvent(), { triggered: true, payload: { foo: "bar" } });

    expect(outcome).toEqual({ status: "sent" });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("does not throw when notification_log write itself fails", async () => {
    vi.mocked(hasSentNotificationToday).mockResolvedValue(false);
    vi.mocked(sendEmail).mockResolvedValue(undefined);
    vi.mocked(insertNotificationLog).mockRejectedValue(new Error("db down"));

    await expect(
      notifyIfNeeded(makeEvent(), { triggered: true, payload: { foo: "bar" } }),
    ).resolves.toEqual({ status: "sent" });
  });

  it("combines multiple weather_task recommendations into a single email", async () => {
    vi.mocked(hasSentNotificationToday).mockResolvedValue(false);
    vi.mocked(sendEmail).mockResolvedValue(undefined);
    vi.mocked(insertNotificationLog).mockResolvedValue({
      id: "log-1",
      eventId: "11111111-1111-1111-1111-111111111111",
      sentAt: new Date(),
      subject: "subject",
      body: "body",
      status: "sent",
    });

    await notifyIfNeeded(makeEvent({ type: "weather_task" }), {
      triggered: true,
      payload: {
        recommendations: [
          { title: "Покос травы", reason: "сухая погода 3 дня" },
          { title: "Фасадные работы", reason: "нет дождя 5 дней подряд" },
        ],
      },
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain("Покос травы");
    expect(call.html).toContain("Фасадные работы");
  });
});

describe("sendTestEmail", () => {
  it("sends a test email regardless of trigger state and does not log it", async () => {
    vi.mocked(sendEmail).mockResolvedValue(undefined);

    await sendTestEmail(makeEvent());

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" }),
    );
    expect(insertNotificationLog).not.toHaveBeenCalled();
    expect(hasSentNotificationToday).not.toHaveBeenCalled();
  });

  it("propagates the error when sending fails", async () => {
    vi.mocked(sendEmail).mockRejectedValue(new Error("bad api key"));

    await expect(sendTestEmail(makeEvent())).rejects.toThrow("bad api key");
  });
});
