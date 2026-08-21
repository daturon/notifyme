import { desc, eq } from "drizzle-orm";
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
