import { NextRequest, NextResponse } from "next/server";
import { createEvent, listEvents, type EventRow } from "@/lib/events/repository";
import { errorResponse, ApiError } from "@/lib/http/api-error";
import { getProvider } from "@/lib/triggers/registry";
import { createEventSchema } from "@/lib/validation/events";

export async function GET() {
  try {
    const events = await listEvents();
    return NextResponse.json({ events });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = createEventSchema.parse(body);

    // Тип уже проверен на существование в реестре (см. eventTypeSchema),
    // здесь провайдер точно найдётся.
    const provider = getProvider(input.type);
    if (!provider) {
      throw new ApiError(400, `Unknown event type: ${input.type}`);
    }
    const config = provider.configSchema.parse(input.config);

    const event = await createEvent({
      name: input.name,
      // Тип уже проверен на членство в реестре триггеров выше; реестр —
      // источник истины, а не enum в БД, поэтому кастуем явно.
      type: input.type as EventRow["type"],
      config,
      isActive: input.isActive,
      recipientEmail: input.recipientEmail,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
