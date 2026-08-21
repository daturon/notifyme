import { NextRequest, NextResponse } from "next/server";
import { getEventById } from "@/lib/events/repository";
import { ApiError, errorResponse } from "@/lib/http/api-error";
import { sendTestEmail } from "@/lib/notifications/engine";

// Тестовый режим Notification Engine (раздел 4.4 п.3 ТЗ) — отправляет письмо
// на recipient_email события вне зависимости от реального срабатывания
// триггера, чтобы проверить настройку Resend прямо из UI.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const event = await getEventById(id);
    if (!event) {
      throw new ApiError(404, `Event ${id} not found`);
    }

    try {
      await sendTestEmail(event);
    } catch (error) {
      throw new ApiError(502, error instanceof Error ? error.message : "Не удалось отправить письмо через Resend");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
