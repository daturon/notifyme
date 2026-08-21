import { NextRequest, NextResponse } from "next/server";
import { getEventById, getEventHistory } from "@/lib/events/repository";
import { ApiError, errorResponse } from "@/lib/http/api-error";
import { historyQuerySchema } from "@/lib/validation/events";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const event = await getEventById(id);
    if (!event) {
      throw new ApiError(404, `Event ${id} not found`);
    }

    const { limit } = historyQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const history = await getEventHistory(id, limit);
    return NextResponse.json(history);
  } catch (error) {
    return errorResponse(error);
  }
}
