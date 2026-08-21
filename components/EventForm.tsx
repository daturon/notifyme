"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getEventTypes, type Event, type EventInput } from "@/lib/api/events";

export interface EventFormValues {
  name: string;
  type: string;
  recipientEmail: string;
  isActive: boolean;
  configText: string;
}

function toFormValues(event?: Event): EventFormValues {
  return {
    name: event?.name ?? "",
    type: event?.type ?? "",
    recipientEmail: event?.recipientEmail ?? "",
    isActive: event?.isActive ?? true,
    configText: event ? JSON.stringify(event.config, null, 2) : "{}",
  };
}

export function EventForm({
  event,
  onSubmit,
  submitLabel,
  pending,
  submitError,
}: {
  event?: Event;
  onSubmit: (input: EventInput) => Promise<void>;
  submitLabel: string;
  pending: boolean;
  submitError?: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<EventFormValues>(() => toFormValues(event));
  const [configError, setConfigError] = useState<string | null>(null);

  const typesQuery = useQuery({ queryKey: ["event-types"], queryFn: getEventTypes });

  function update<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setConfigError(null);

    let config: unknown;
    try {
      config = JSON.parse(values.configText);
    } catch {
      setConfigError("Некорректный JSON");
      return;
    }

    await onSubmit({
      name: values.name,
      type: values.type,
      recipientEmail: values.recipientEmail,
      isActive: values.isActive,
      config,
    });
  }

  const types = typesQuery.data?.types ?? [];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Название
        </label>
        <input
          id="name"
          type="text"
          required
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="type" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Тип события
        </label>
        <select
          id="type"
          required
          value={values.type}
          onChange={(e) => update("type", e.target.value)}
          disabled={typesQuery.isLoading}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          <option value="" disabled>
            {typesQuery.isLoading ? "Загрузка типов…" : "Выберите тип"}
          </option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        {typesQuery.isError && (
          <p className="text-xs text-red-600 dark:text-red-400">Не удалось загрузить список типов</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="recipientEmail" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email получателя
        </label>
        <input
          id="recipientEmail"
          type="email"
          required
          value={values.recipientEmail}
          onChange={(e) => update("recipientEmail", e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => update("isActive", e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
        />
        Событие активно
      </label>

      <div className="flex flex-col gap-1">
        <label htmlFor="config" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Config (JSON)
        </label>
        <textarea
          id="config"
          rows={8}
          value={values.configText}
          onChange={(e) => update("configText", e.target.value)}
          spellCheck={false}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {configError && <p className="text-xs text-red-600 dark:text-red-400">{configError}</p>}
      </div>

      {submitError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {submitError}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          {pending ? "Сохранение…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
