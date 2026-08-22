import { NextRequest, NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/http/api-error";
import { todayDateString } from "@/lib/triggers/weatherTask/date";
import { getTaskById, markTaskDone } from "@/lib/triggers/weatherTask/repository";

// Раздел 4.3 п.4 / раздел 6 ТЗ: отметка "выполнено" проставляет
// last_done_at = сегодня (локальная дата, см. date.ts) — это выключает
// повторные рекомендации до следующего цикла периодичности.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await getTaskById(id);
    if (!existing) {
      throw new ApiError(404, `Task ${id} not found`);
    }

    const task = await markTaskDone(id, todayDateString());
    return NextResponse.json({ task });
  } catch (error) {
    return errorResponse(error);
  }
}
