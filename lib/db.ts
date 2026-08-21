import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db/schema";

// Синглтон через globalThis: в dev-режиме Next.js модуль пересоздаётся при каждом
// hot-reload, что плодило бы новые подключения к Supabase на каждое изменение файла.
const globalForDb = globalThis as unknown as {
  queryClient: postgres.Sql | undefined;
};

// DATABASE_URL умышленно не проверяется здесь: postgres.js подключается лениво,
// при первом запросе, а не при импорте модуля — модуль импортируют роуты,
// которые Next.js загружает на этапе сборки (collecting page data), когда
// переменных окружения ещё может не быть.
const connectionString = process.env.DATABASE_URL ?? "postgresql://placeholder";

const queryClient =
  globalForDb.queryClient ??
  postgres(connectionString, {
    // Supabase pooler (pgbouncer в режиме transaction) не поддерживает
    // server-side prepared statements.
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.queryClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
