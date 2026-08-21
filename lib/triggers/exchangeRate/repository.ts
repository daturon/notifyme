import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db } from "../../db";
import { rateHistory } from "../../db/schema";
import { subtractDays } from "./date";
import type { RatePoint } from "./logic";

export type RateHistoryRow = typeof rateHistory.$inferSelect;

function toRatePoint(row: RateHistoryRow): RatePoint {
  return { recordedAt: row.recordedAt, rate: Number(row.rate), sourceName: row.sourceName };
}

// Upsert по (event_id, source_name, recorded_at) — пункт 2.c задания:
// повторный запуск проверки в тот же день обновляет строку, а не плодит
// дубли.
export async function upsertTodayRate(params: {
  eventId: string;
  sourceName: string;
  rate: number;
  recordedAt: string;
}): Promise<void> {
  await db
    .insert(rateHistory)
    .values({
      eventId: params.eventId,
      sourceName: params.sourceName,
      rate: params.rate.toString(),
      recordedAt: params.recordedAt,
    })
    .onConflictDoUpdate({
      target: [rateHistory.eventId, rateHistory.sourceName, rateHistory.recordedAt],
      set: { rate: params.rate.toString() },
    });
}

// Записи за последние `days` дней (включительно `asOfDate`) для события, по
// возрастанию даты — пункт 2.d задания. Граница окна считается от `asOfDate`
// (местная дата, см. date.ts), а не от current_date БД, чтобы не разъезжаться
// с датой, под которой провайдер только что записал сегодняшний курс.
export async function getRateHistoryWindow(
  eventId: string,
  days: number,
  asOfDate: string,
): Promise<RatePoint[]> {
  const from = subtractDays(asOfDate, days - 1);
  const rows = await db
    .select()
    .from(rateHistory)
    .where(and(eq(rateHistory.eventId, eventId), gte(rateHistory.recordedAt, from)))
    .orderBy(asc(rateHistory.recordedAt));

  return rows.map(toRatePoint);
}

// Последние `limit` точек для мини-графика на странице события — не
// ограничено окном триггера, просто "последние N значений" (пункт 4
// задания).
export async function getRateHistorySeries(eventId: string, limit: number): Promise<RatePoint[]> {
  const rows = await db
    .select()
    .from(rateHistory)
    .where(eq(rateHistory.eventId, eventId))
    .orderBy(desc(rateHistory.recordedAt))
    .limit(limit);

  return rows.map(toRatePoint).reverse();
}
