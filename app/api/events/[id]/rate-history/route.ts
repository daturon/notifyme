import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEventById } from "@/lib/events/repository";
import { ApiError, errorResponse } from "@/lib/http/api-error";
import { getRateHistorySeries } from "@/lib/triggers/exchangeRate/repository";

// Данные для мини-графика на странице события (раздел 4 задания, пункт 4) —
// последние `limit` значений rate_history, а не окно триггера.
const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(90).optional().default(30),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const event = await getEventById(id);
    if (!event) {
      throw new ApiError(404, `Event ${id} not found`);
    }

    const { limit } = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const series = await getRateHistorySeries(id, limit);

    return NextResponse.json({ series });
  } catch (error) {
    return errorResponse(error);
  }
}
