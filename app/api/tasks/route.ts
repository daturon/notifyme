import { NextRequest, NextResponse } from "next/server";
import { getEventById } from "@/lib/events/repository";
import { ApiError, errorResponse } from "@/lib/http/api-error";
import { createTask, listTasksByEvent } from "@/lib/triggers/weatherTask/repository";
import { createTaskSchema } from "@/lib/validation/tasks";

// CRUD задач по дому (раздел 4.3, раздел 6 ТЗ). Вынесены в собственный
// эндпоинт, а не под /api/events/:id — задачи имеют независимый жизненный
// цикл (отмечаются выполненными отдельно от событий, раздел 5 ТЗ).
export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get("eventId");
    if (!eventId) {
      throw new ApiError(400, "eventId query parameter is required");
    }

    const tasks = await listTasksByEvent(eventId);
    return NextResponse.json({ tasks });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = createTaskSchema.parse(body);

    const event = await getEventById(input.eventId);
    if (!event) {
      throw new ApiError(404, `Event ${input.eventId} not found`);
    }
    if (event.type !== "weather_task") {
      throw new ApiError(400, "Tasks can only be added to weather_task events");
    }

    const task = await createTask({
      eventId: input.eventId,
      title: input.title,
      intervalDays: input.intervalDays,
      weatherRules: input.weatherRules,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
