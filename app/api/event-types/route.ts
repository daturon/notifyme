import { NextResponse } from "next/server";
import { listProviderTypes } from "@/lib/triggers/registry";

// Отдаёт зарегистрированные типы триггеров, чтобы форма создания/редактирования
// события строила select динамически, а не по захардкоженному списку (раздел 7 ТЗ).
export async function GET() {
  return NextResponse.json({ types: listProviderTypes() });
}
