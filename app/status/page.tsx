import { getStatusStats } from "@/lib/events/repository";

export const dynamic = "force-dynamic";

const STATUS_TIME_ZONE = "Europe/Minsk";

function formatDateTime(date: Date | null): string {
  if (!date) return "ещё не запускался";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: STATUS_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// Простая живая проверка "всё работает" без захода в логи Vercel (раздел 9
// п.4 ТЗ): время последнего запуска cron берётся из run_log, а не из
// какого-то отдельного heartbeat — он пишется на каждый обработанный event,
// в т.ч. при ошибке провайдера, так что здесь это честный признак того, что
// cron вообще исполнялся.
export default async function StatusPage() {
  const stats = await getStatusStats();

  const cards = [
    { label: "Последний запуск cron", value: formatDateTime(stats.lastRunAt) },
    { label: "Активных событий", value: String(stats.activeEventsCount) },
    { label: "Писем отправлено за 7 дней", value: String(stats.sentLast7Days) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Статус</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{card.label}</p>
            <p className="mt-1 text-lg font-semibold text-black dark:text-zinc-50">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
