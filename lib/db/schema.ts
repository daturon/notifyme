/**
 * ORM: Drizzle, not Prisma.
 *
 * Причина выбора — ограничения проекта из ТЗ (раздел 7): деплой на Vercel Hobby,
 * функции без "теплого" окружения и с лимитом времени выполнения.
 * - Drizzle — это тонкий слой над SQL без отдельного query-engine-бинарника
 *   (в отличие от Prisma, который тянет за собой Rust-движок и добавляет
 *   заметный holodный старт в serverless-функциях).
 * - Клиент работает поверх обычного `postgres` (postgres.js) драйвера,
 *   легко живёт в serverless/edge-окружении и не требует шага `generate`
 *   для клиента (только для миграций).
 * - Схема — обычный TypeScript, без отдельного DSL-файла и кодогенерации типов.
 *
 * Структура строго по разделу 5 ТЗ (NotifyMe_TZ.md), со следующими уточнениями
 * типов (набор полей не менялся):
 * - id: uuid с default gen_random_uuid() вместо генерации на клиенте;
 * - type в events и status в notification_log — pg enum вместо свободного text,
 *   чтобы исключить опечатки в значениях ('exchange_rate' | 'weather_task', 'sent' | 'failed');
 * - внешние ключи (event_id) — с onDelete: 'cascade', чтобы при удалении события
 *   не оставались висящие задачи/логи;
 * - добавлены индексы под самые частые запросы cron-обработчика и истории
 *   (events.is_active, *_log.event_id).
 */

import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// 'noop' — тестовый провайдер-заглушка (lib/triggers/providers/noop.ts) для
// обкатки реестра триггеров и API до появления реальных типов.
export const eventTypeEnum = pgEnum("event_type", ["exchange_rate", "weather_task", "noop"]);
export const notificationStatusEnum = pgEnum("notification_status", ["sent", "failed"]);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: eventTypeEnum("type").notNull(),
    // специфичные для типа параметры (например, порог курса или список работ)
    config: jsonb("config").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    recipientEmail: text("recipient_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("events_is_active_idx").on(table.isActive)],
);

// Задачи по дому для событий типа weather_task. Вынесены в отдельную таблицу
// (а не в config события), чтобы поддерживать независимый CRUD и отметку
// «выполнено» по каждой задаче отдельно (см. раздел 8, экран 3).
export const householdTasks = pgTable(
  "household_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    intervalDays: integer("interval_days").notNull(),
    // условия погоды для этой конкретной работы (например, диапазон температур,
    // число дней без осадков)
    weatherRules: jsonb("weather_rules").notNull(),
    lastDoneAt: date("last_done_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("household_tasks_event_id_idx").on(table.eventId)],
);

// Временной ряд курсов для типа exchange_rate (раздел 5 ТЗ) — источник для
// скользящего окна/локального максимума (раздел 4.2). Одна запись в сутки на
// событие: source_name — точка обмена, давшая лучший (максимальный) курс в
// этот день; rate — курс сдачи RUB в BYN за 100 RUB.
export const rateHistory = pgTable(
  "rate_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sourceName: text("source_name").notNull(),
    rate: numeric("rate", { precision: 10, scale: 4 }).notNull(),
    recordedAt: date("recorded_at").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("rate_history_event_id_idx").on(table.eventId),
    unique("rate_history_event_source_date_unique").on(
      table.eventId,
      table.sourceName,
      table.recordedAt,
    ),
  ],
);

// Лог каждого запуска cron-проверки — для отладки и истории (раздел 3, шаг 5).
export const runLog = pgTable(
  "run_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
    triggered: boolean("triggered").notNull(),
    // сырые данные провайдера-триггера (курсы, прогноз погоды и т.д.)
    rawResult: jsonb("raw_result"),
  },
  (table) => [index("run_log_event_id_idx").on(table.eventId)],
);

// Лог отправленных уведомлений — источник правды для правила «не чаще 1 письма
// в сутки на событие» (раздел 1.2).
export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    subject: text("subject"),
    body: text("body"),
    status: notificationStatusEnum("status").notNull(),
  },
  (table) => [index("notification_log_event_id_idx").on(table.eventId)],
);

export const eventsRelations = relations(events, ({ many }) => ({
  householdTasks: many(householdTasks),
  rateHistory: many(rateHistory),
  runLog: many(runLog),
  notificationLog: many(notificationLog),
}));

export const householdTasksRelations = relations(householdTasks, ({ one }) => ({
  event: one(events, { fields: [householdTasks.eventId], references: [events.id] }),
}));

export const rateHistoryRelations = relations(rateHistory, ({ one }) => ({
  event: one(events, { fields: [rateHistory.eventId], references: [events.id] }),
}));

export const runLogRelations = relations(runLog, ({ one }) => ({
  event: one(events, { fields: [runLog.eventId], references: [events.id] }),
}));

export const notificationLogRelations = relations(notificationLog, ({ one }) => ({
  event: one(events, { fields: [notificationLog.eventId], references: [events.id] }),
}));
