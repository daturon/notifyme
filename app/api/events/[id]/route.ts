import { NextRequest, NextResponse } from "next/server";
import { deleteEvent, getEventById, updateEvent, type EventRow } from "@/lib/events/repository";
import { ApiError, errorResponse } from "@/lib/http/api-error";
import { getProvider } from "@/lib/triggers/registry";
import { updateEventSchema } from "@/lib/validation/events";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const event = await getEventById(id);
    if (!event) {
      throw new ApiError(404, `Event ${id} not found`);
    }
    return NextResponse.json({ event });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = updateEventSchema.parse(body);

    const existing = await getEventById(id);
    if (!existing) {
      throw new ApiError(404, `Event ${id} not found`);
    }

    // Конфиг валидируется по схеме итогового типа (новый, если меняется, иначе
    // текущий), чтобы нельзя было сохранить config, не совпадающий с type.
    let config = input.config;
    if (input.type !== undefined || input.config !== undefined) {
      const effectiveType = input.type ?? existing.type;
      const provider = getProvider(effectiveType);
      if (!provider) {
        throw new ApiError(400, `Unknown event type: ${effectiveType}`);
      }
      config = provider.configSchema.parse(input.config ?? existing.config);
    }

    const updated = await updateEvent(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type as EventRow["type"] } : {}),
      ...(config !== undefined ? { config } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.recipientEmail !== undefined ? { recipientEmail: input.recipientEmail } : {}),
    });

    return NextResponse.json({ event: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteEvent(id);
    if (!deleted) {
      throw new ApiError(404, `Event ${id} not found`);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
