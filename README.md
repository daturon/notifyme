# NotifyMe

Персональное приложение для мониторинга событий и email-уведомлений. Next.js 15 (App Router) + TypeScript + Tailwind CSS, деплой на Vercel.

## Как запустить локально

```bash
pnpm install
pnpm run dev
```

Приложение будет доступно на [http://localhost:3000](http://localhost:3000).

## Переменные окружения

Скопируйте `.env.example` в `.env.local` и заполните значения:

```bash
cp .env.example .env.local
```

- `DATABASE_URL` — строка подключения к Postgres; берётся в дашборде вашего провайдера БД (например Supabase или Neon).
- `RESEND_API_KEY` — API-ключ для отправки email; создаётся в личном кабинете [Resend](https://resend.com).
- `CRON_SECRET` — произвольный секрет для защиты эндпоинта крон-задачи; придумайте сами и используйте при настройке Vercel Cron.
- `APP_PASSWORD` — пароль для доступа к однопользовательскому приложению; придумайте сами.

## База данных

ORM — [Drizzle](https://orm.drizzle.team) (обоснование выбора см. в комментарии в начале `lib/db/schema.ts`), БД — Postgres (Supabase). Схема описана в `lib/db/schema.ts` по разделу 5 ТЗ, миграции лежат в `drizzle/`.

```bash
# создать SQL-миграцию из текущей схемы (после изменений в lib/db/schema.ts)
pnpm run db:generate

# применить миграции к БД, на которую указывает DATABASE_URL
pnpm run db:migrate

# заполнить БД тестовыми событиями (по одному на каждый тип триггера)
pnpm run db:seed

# GUI для просмотра данных
pnpm run db:studio
```

## API

Слой данных для CRUD событий и ручной проверки триггеров (раздел 6 ТЗ). Типы триггеров регистрируются в `lib/triggers/registry.ts` (сейчас — только заглушка `noop`), config каждого события валидируется по `configSchema` соответствующего провайдера.

| Метод  | Путь                       | Назначение                                                        |
| ------ | -------------------------- | ----------------------------------------------------------------- |
| GET    | `/api/events`              | список событий                                                    |
| POST   | `/api/events`              | создать событие                                                   |
| PUT    | `/api/events/:id`          | изменить событие                                                  |
| DELETE | `/api/events/:id`          | удалить событие                                                   |
| POST   | `/api/events/:id/test-run` | проверить условие провайдера без отправки письма, пишет в run_log |
| GET    | `/api/events/:id/history`  | последние N записей run_log и notification_log (`?limit=`)        |

Cron-эндпоинт и UI пока не реализованы.

## Скрипты

- `pnpm run dev` — запуск дев-сервера
- `pnpm run build` — production-сборка
- `pnpm run start` — запуск production-сборки
- `pnpm run lint` — проверка ESLint
- `pnpm run format` — форматирование Prettier
- `pnpm run test` — тесты (Vitest) на API-роуты
- `pnpm run db:generate` / `db:migrate` / `db:seed` / `db:studio` — см. раздел «База данных»
