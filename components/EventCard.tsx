"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  ApiClientError,
  getEventHistory,
  testRunEvent,
  updateEvent,
  type Event,
  type TestRunResult,
} from "@/lib/api/events";
import { Modal } from "@/components/Modal";

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU");
}

export function EventCard({ event }: { event: Event }) {
  const queryClient = useQueryClient();
  const [testRunResult, setTestRunResult] = useState<TestRunResult | null>(null);
  const [testRunFailed, setTestRunFailed] = useState<string | null>(null);

  const historyQuery = useQuery({
    queryKey: ["events", event.id, "history", "summary"],
    queryFn: () => getEventHistory(event.id, 1),
  });

  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) => updateEvent(event.id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const testRunMutation = useMutation({
    mutationFn: () => testRunEvent(event.id),
    onSuccess: (data) => {
      setTestRunResult(data);
      setTestRunFailed(null);
      queryClient.invalidateQueries({ queryKey: ["events", event.id, "history"] });
    },
    onError: (err) => {
      setTestRunFailed(err instanceof ApiClientError ? err.message : "Не удалось выполнить проверку");
    },
  });

  const lastCheckedAt = historyQuery.data?.runLog[0]?.ranAt;
  const lastNotifiedAt = historyQuery.data?.notificationLog[0]?.sentAt;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-black dark:text-zinc-50">{event.name}</h3>
          <p className="text-xs text-zinc-500">{event.type}</p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2">
          <span className="text-xs text-zinc-500">{event.isActive ? "Активно" : "Выключено"}</span>
          <input
            type="checkbox"
            checked={event.isActive}
            disabled={toggleMutation.isPending}
            onChange={(e) => toggleMutation.mutate(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
          />
        </label>
      </div>

      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-zinc-500">
        <dt>Последняя проверка</dt>
        <dd className="text-right">{formatDate(lastCheckedAt)}</dd>
        <dt>Последнее уведомление</dt>
        <dd className="text-right">{formatDate(lastNotifiedAt)}</dd>
      </dl>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => {
            setTestRunFailed(null);
            testRunMutation.mutate();
          }}
          disabled={testRunMutation.isPending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          {testRunMutation.isPending ? "Проверяем…" : "Проверить сейчас"}
        </button>
        <Link
          href={`/events/${event.id}/edit`}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Редактировать
        </Link>
        <Link
          href={`/events/${event.id}/history`}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          История
        </Link>
      </div>

      {testRunFailed && (
        <Modal title="Ошибка проверки" onClose={() => setTestRunFailed(null)}>
          <p className="text-sm text-red-600 dark:text-red-400">{testRunFailed}</p>
        </Modal>
      )}

      {testRunResult && (
        <Modal title="Результат проверки" onClose={() => setTestRunResult(null)}>
          <div className="flex flex-col gap-2 text-sm">
            <p>
              Сработало:{" "}
              <span
                className={
                  testRunResult.result.triggered
                    ? "font-medium text-emerald-600 dark:text-emerald-400"
                    : "font-medium text-zinc-500"
                }
              >
                {testRunResult.result.triggered ? "Да" : "Нет"}
              </span>
            </p>
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-500">Данные провайдера</p>
              <pre className="max-h-64 overflow-auto rounded-md bg-zinc-100 p-2 text-xs dark:bg-zinc-800">
                {JSON.stringify(testRunResult.result.payload, null, 2)}
              </pre>
            </div>
            <p className="text-xs text-zinc-500">
              Письмо не отправлялось — это тестовая проверка условия.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
