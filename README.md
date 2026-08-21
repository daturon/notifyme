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
| POST   | `/api/events/:id/send-test`| отправить тестовое письмо (не завязано на срабатывание триггера)  |
| GET    | `/api/events/:id/history`  | последние N записей run_log и notification_log (`?limit=`)        |
| GET/POST | `/api/cron/run`          | вызывается Vercel Cron; проверяет все активные события и шлёт уведомления (см. «Cron» ниже) |

## Cron

`/api/cron/run` (раздел 3, 6 ТЗ) закрыт заголовком `Authorization: Bearer $CRON_SECRET` — запрос без него или с неверным значением получает 401. При успешной авторизации обработчик выбирает все активные события, для каждого вызывает `check()` соответствующего провайдера из `lib/triggers/registry.ts` и `notifyIfNeeded()` из `lib/notifications/engine.ts`. Каждое событие обрабатывается в своём `try/catch` — падение одного провайдера не прерывает обработку остальных. Ответ — сводка: `checked`, `triggered`, `sent`, список `results` по каждому событию и `errors`, если были.

Расписание задано в `vercel.json` (`0 5 * * *`, т.е. 5:00–5:59 UTC — 8:00–8:59 по Europe/Minsk, часовому поясу, который использует Notification Engine для дедупликации "1 письмо в сутки"). Vercel Cron всегда работает в UTC и на Hobby-плане срабатывает в пределах часа, а не в точную минуту.

Протестировать эндпоинт локально, не дожидаясь реального срабатывания cron:

```bash
# .env.local должен содержать тот же CRON_SECRET, что используется ниже
pnpm run dev

curl -i -X POST http://localhost:3000/api/cron/run \
  -H "Authorization: Bearer $CRON_SECRET"
```

Без корректного заголовка (или без него) эндпоинт вернёт `401 Unauthorized`.

**После деплоя обязательно проверьте в Vercel Dashboard (Project → Settings → Environment Variables), что переменная `CRON_SECRET` задана для production-окружения** — Vercel сам подставляет её значение в заголовок `Authorization: Bearer …` при вызове cron-задач (раздел 7 ТЗ), поэтому значение в Vercel и значение, которое проверяет `/api/cron/run`, должны быть одной и той же переменной окружения проекта, а не двумя независимо придуманными секретами.

## Статус

`/status` (раздел 9 п.4 ТЗ) — простая страница для беглой проверки "всё живо", не заходя в логи Vercel: время последнего запуска cron (из `run_log`), число активных событий, число писем, отправленных за последние 7 дней (из `notification_log`). Закрыта тем же паролем (`APP_PASSWORD`), что и остальное приложение.

## Деплой на Vercel

1. **Подключите репозиторий.** [vercel.com/new](https://vercel.com/new) → Import Git Repository → выберите этот репозиторий. Next.js определяется автоматически, Build Command/Output Directory менять не нужно.

2. **Заведите Postgres.** Проще всего — через Vercel Marketplace: Project → Storage → Create Database → Supabase (или Neon). После создания Vercel сам пропишет `DATABASE_URL` в переменные окружения проекта.
   Если БД уже есть в отдельном Supabase-проекте — connection string берётся в Supabase Dashboard → Project Settings → Database → Connection string (**Transaction pooler**, порт 6543 — именно pooler-строка, не прямое подключение, т.к. serverless-функции открывают много коротких соединений).

3. **Получите ключ Resend.** [resend.com](https://resend.com) → API Keys → Create API Key. Без верификации собственного домена письма можно слать только с `onboarding@resend.dev` (значение по умолчанию для `NOTIFICATIONS_FROM_EMAIL`) — этого достаточно для запуска.

4. **Добавьте переменные окружения.** Project → Settings → Environment Variables, для **Production** (и, при желании, Preview):

   | Переменная                  | Значение                                                             |
   | ---------------------------- | --------------------------------------------------------------------- |
   | `DATABASE_URL`                | connection string из шага 2                                          |
   | `RESEND_API_KEY`              | ключ из шага 3                                                       |
   | `NOTIFICATIONS_FROM_EMAIL`    | опционально; по умолчанию `NotifyMe <onboarding@resend.dev>`         |
   | `CRON_SECRET`                 | сгенерируйте случайную строку (например, `openssl rand -hex 32`)     |
   | `APP_PASSWORD`                | пароль для входа в приложение                                        |

5. **Примените миграции к продакшн-БД.** Локально, указав `DATABASE_URL` продакшна:

   ```bash
   DATABASE_URL=<production connection string> pnpm run db:migrate
   ```

6. **Задеплойте.** Push в основную ветку (или Deploy в интерфейсе Vercel). `vercel.json` уже содержит расписание крон-задачи — Vercel создаст её автоматически при первом продакшн-деплое.

### Что проверить вручную после деплоя

- **Resend → Domains**: если планируете слать не с `onboarding@resend.dev`, а со своего адреса — добавьте и верифицируйте домен (Resend Dashboard → Domains), затем обновите `NOTIFICATIONS_FROM_EMAIL`.
- **Vercel Dashboard → Settings → Cron Jobs**: убедитесь, что задача `/api/cron/run` создана и включена (создаётся автоматически из `vercel.json`, но на Hobby-плане cron включён по умолчанию только для одного проекта аккаунта — проверьте, что это не конфликтует с другими).
- **Vercel Dashboard → Settings → Environment Variables**: `CRON_SECRET` должен быть задан для Production — иначе `/api/cron/run` будет отвечать `401` даже вызовам от самого Vercel Cron (см. раздел «Cron» выше).
- Открыть `/status` после первого срабатывания cron и убедиться, что «Последний запуск» и счётчики обновились.
- Зайти на продакшн-домен и убедиться, что форма пароля (`/login`) действительно требуется — если нет, значит `APP_PASSWORD` не подхватился.

## Скрипты

- `pnpm run dev` — запуск дев-сервера
- `pnpm run build` — production-сборка
- `pnpm run start` — запуск production-сборки
- `pnpm run lint` — проверка ESLint
- `pnpm run format` — форматирование Prettier
- `pnpm run test` — тесты (Vitest) на API-роуты
- `pnpm run db:generate` / `db:migrate` / `db:seed` / `db:studio` — см. раздел «База данных»
