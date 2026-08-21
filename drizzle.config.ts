import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// DATABASE_URL нужен только для `drizzle-kit migrate` (применение миграций
// к реальной БД). `drizzle-kit generate` только читает файл схемы и в
// реальном подключении не нуждается, поэтому здесь достаточно заглушки.
const connectionString = process.env.DATABASE_URL ?? "postgresql://localhost:5432/placeholder";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
