import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { events, notificationLog, runLog } from "../db/schema";

export type EventRow = typeof events.$inferSelect;
export type NewEventInput = typeof events.$inferInsert;
export type RunLogRow = typeof runLog.$inferSelect;
export type NotificationLogRow = typeof notificationLog.$inferSelect;

// Тонкий слой поверх Drizzle: API-роуты и тесты работают с этими функциями,
// а не с db-клиентом напрямую — в тестах модуль мокается целиком.

export async function listEvents(): Promise<EventRow[]> {
  return db.select().from(events).orderBy(desc(events.createdAt));
}

export async function getEventById(id: string): Promise<EventRow | undefined> {
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return event;
}

export async function createEvent(input: NewEventInput): Promise<EventRow> {
  const [event] = await db.insert(events).values(input).returning();
  return event;
}

export async function updateEvent(
  id: string,
  input: Partial<NewEventInput>,
): Promise<EventRow | undefined> {
  const [event] = await db
    .update(events)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning();
  return event;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const deleted = await db.delete(events).where(eq(events.id, id)).returning({ id: events.id });
  return deleted.length > 0;
}

export async function insertRunLog(entry: {
  eventId: string;
  triggered: boolean;
  rawResult: unknown;
}): Promise<RunLogRow> {
  const [row] = await db
    .insert(runLog)
    .values({
      eventId: entry.eventId,
      triggered: entry.triggered,
      rawResult: entry.rawResult,
    })
    .returning();
  return row;
}

// "Сегодня" — по локальному часовому поясу пользователя, а не UTC-дате
// сервера (тот же принцип, что и в lib/triggers/exchangeRate/date.ts, раздел
// 9 п.5 ТЗ). Сравниваем календарные даты, а не диапазон timestamptz, чтобы не
// возиться с UTC-смещением/DST при построении границ суток.
const NOTIFICATION_TIME_ZONE = "Europe/Minsk";

function localDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NOTIFICATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Источник правды для правила "не более 1 письма в сутки на событие"
// (раздел 1.2, 4.4 ТЗ) — используется Notification Engine.
export async function hasSentNotificationToday(eventId: string, now: Date = new Date()): Promise<boolean> {
  const [latest] = await db
    .select({ sentAt: notificationLog.sentAt })
    .from(notificationLog)
    .where(and(eq(notificationLog.eventId, eventId), eq(notificationLog.status, "sent")))
    .orderBy(desc(notificationLog.sentAt))
    .limit(1);

  if (!latest) return false;
  return localDateString(latest.sentAt) === localDateString(now);
}

export async function insertNotificationLog(entry: {
  eventId: string;
  subject: string;
  body: string;
  status: "sent" | "failed";
}): Promise<NotificationLogRow> {
  const [row] = await db.insert(notificationLog).values(entry).returning();
  return row;
}

export async function getEventHistory(
  eventId: string,
  limit: number,
): Promise<{ runLog: RunLogRow[]; notificationLog: NotificationLogRow[] }> {
  const [runLogRows, notificationLogRows] = await Promise.all([
    db
      .select()
      .from(runLog)
      .where(eq(runLog.eventId, eventId))
      .orderBy(desc(runLog.ranAt))
      .limit(limit),
    db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.eventId, eventId))
      .orderBy(desc(notificationLog.sentAt))
      .limit(limit),
  ]);

  return { runLog: runLogRows, notificationLog: notificationLogRows };
}
