"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RateHistoryChart } from "@/components/RateHistoryChart";
import { getEvent, getEventHistory, getEventRateHistory } from "@/lib/api/events";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU");
}

export default function EventHistoryPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const eventQuery = useQuery({ queryKey: ["events", id], queryFn: () => getEvent(id) });
  const historyQuery = useQuery({
    queryKey: ["events", id, "history"],
    queryFn: () => getEventHistory(id),
  });
  const isExchangeRate = eventQuery.data?.event.type === "exchange_rate";
  const rateHistoryQuery = useQuery({
    queryKey: ["events", id, "rate-history"],
    queryFn: () => getEventRateHistory(id),
    enabled: isExchangeRate,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          История{eventQuery.data ? `: ${eventQuery.data.event.name}` : ""}
        </h1>
        <Link href="/events" className="text-sm text-zinc-500 hover:underline">
          ← к списку
        </Link>
      </div>

      {historyQuery.isLoading && <p className="text-sm text-zinc-500">Загрузка…</p>}

      {historyQuery.isError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Не удалось загрузить историю
        </p>
      )}

      {isExchangeRate && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Курс за последние дни</h2>
          {rateHistoryQuery.isLoading && <p className="text-sm text-zinc-500">Загрузка…</p>}
          {rateHistoryQuery.data && <RateHistoryChart points={rateHistoryQuery.data.series} />}
        </section>
      )}

      {historyQuery.data && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Запуски проверки</h2>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Дата</th>
                    <th className="px-3 py-2 font-medium">Сработало</th>
                    <th className="px-3 py-2 font-medium">Данные</th>
                  </tr>
                </thead>
                <tbody>
                  {historyQuery.data.runLog.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-zinc-500">
                        Пока нет запусков
                      </td>
                    </tr>
                  )}
                  {historyQuery.data.runLog.map((entry) => (
                    <tr key={entry.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-3 py-2 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                        {formatDate(entry.ranAt)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            entry.triggered
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-zinc-500"
                          }
                        >
                          {entry.triggered ? "Да" : "Нет"}
                        </span>
                      </td>
                      <td className="max-w-xs truncate px-3 py-2 font-mono text-xs text-zinc-500">
                        {entry.rawResult ? JSON.stringify(entry.rawResult) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Отправленные уведомления
            </h2>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Дата</th>
                    <th className="px-3 py-2 font-medium">Тема</th>
                    <th className="px-3 py-2 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {historyQuery.data.notificationLog.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-zinc-500">
                        Пока нет уведомлений
                      </td>
                    </tr>
                  )}
                  {historyQuery.data.notificationLog.map((entry) => (
                    <tr key={entry.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-3 py-2 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                        {formatDate(entry.sentAt)}
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {entry.subject ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            entry.status === "sent"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {entry.status === "sent" ? "Отправлено" : "Ошибка"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
