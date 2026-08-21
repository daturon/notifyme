import { NextRequest, NextResponse } from "next/server";
import { getEventById, insertRunLog } from "@/lib/events/repository";
import { ApiError, errorResponse } from "@/lib/http/api-error";
import { getProvider } from "@/lib/triggers/registry";

// Проверяет условие триггера без отправки письма (раздел 4.1 ТЗ) — не
// расходует лимит уведомлений. Пишет результат в run_log, но не в
// notification_log, т.к. письмо не отправляется.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const event = await getEventById(id);
    if (!event) {
      throw new ApiError(404, `Event ${id} not found`);
    }

    const provider = getProvider(event.type);
    if (!provider) {
      throw new ApiError(500, `No provider registered for event type: ${event.type}`);
    }

    const result = await provider.check(event.config, { eventId: event.id });

    const logEntry = await insertRunLog({
      eventId: event.id,
      triggered: result.triggered,
      rawResult: result.payload,
    });

    return NextResponse.json({ result, runLog: logEntry });
  } catch (error) {
    return errorResponse(error);
  }
}
