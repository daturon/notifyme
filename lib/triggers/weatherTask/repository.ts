import { asc, eq } from "drizzle-orm";
import { db } from "../../db";
import { householdTasks } from "../../db/schema";

export type HouseholdTaskRow = typeof householdTasks.$inferSelect;
export type NewHouseholdTaskInput = typeof householdTasks.$inferInsert;

// Тонкий слой поверх Drizzle (тот же принцип, что и lib/events/repository.ts)
// — API-роуты, провайдер и тесты работают с этими функциями, модуль
// мокается целиком в тестах.

export async function listTasksByEvent(eventId: string): Promise<HouseholdTaskRow[]> {
  return db
    .select()
    .from(householdTasks)
    .where(eq(householdTasks.eventId, eventId))
    .orderBy(asc(householdTasks.createdAt));
}

export async function getTaskById(id: string): Promise<HouseholdTaskRow | undefined> {
  const [row] = await db.select().from(householdTasks).where(eq(householdTasks.id, id)).limit(1);
  return row;
}

export async function createTask(input: NewHouseholdTaskInput): Promise<HouseholdTaskRow> {
  const [row] = await db.insert(householdTasks).values(input).returning();
  return row;
}

export async function updateTask(
  id: string,
  input: Partial<NewHouseholdTaskInput>,
): Promise<HouseholdTaskRow | undefined> {
  const [row] = await db.update(householdTasks).set(input).where(eq(householdTasks.id, id)).returning();
  return row;
}

export async function deleteTask(id: string): Promise<boolean> {
  const deleted = await db.delete(householdTasks).where(eq(householdTasks.id, id)).returning({ id: householdTasks.id });
  return deleted.length > 0;
}

// Раздел 4.3 п.4 / раздел 6 ТЗ: POST /api/tasks/:id/done проставляет
// last_done_at = сегодня — это выключает повторные рекомендации до
// следующего цикла периодичности.
export async function markTaskDone(id: string, doneAt: string): Promise<HouseholdTaskRow | undefined> {
  const [row] = await db
    .update(householdTasks)
    .set({ lastDoneAt: doneAt })
    .where(eq(householdTasks.id, id))
    .returning();
  return row;
}
