import { NextRequest, NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/http/api-error";
import { deleteTask, getTaskById, updateTask } from "@/lib/triggers/weatherTask/repository";
import { updateTaskSchema } from "@/lib/validation/tasks";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = updateTaskSchema.parse(body);

    const existing = await getTaskById(id);
    if (!existing) {
      throw new ApiError(404, `Task ${id} not found`);
    }

    const updated = await updateTask(id, input);
    return NextResponse.json({ task: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = await deleteTask(id);
    if (!deleted) {
      throw new ApiError(404, `Task ${id} not found`);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
