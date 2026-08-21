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

## Скрипты

- `pnpm run dev` — запуск дев-сервера
- `pnpm run build` — production-сборка
- `pnpm run start` — запуск production-сборки
- `pnpm run lint` — проверка ESLint
- `pnpm run format` — форматирование Prettier
