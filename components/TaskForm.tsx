"use client";

import { useState } from "react";
import type { HouseholdTask, HouseholdTaskWeatherRules, TaskInput } from "@/lib/api/tasks";

// Форма добавления/редактирования задачи (раздел 8, экран 3 ТЗ): понятные
// поля — периодичность в днях, погодные условия через простые контролы
// ("минимум N дней подряд без дождя", диапазон температуры) — вместо
// сырого JSON.
export interface TaskFormValues {
  title: string;
  intervalDays: number;
  minDryDaysInRow: number;
  tempRangeEnabled: boolean;
  minTempC: number;
  maxTempC: number;
}

const DEFAULT_VALUES: TaskFormValues = {
  title: "",
  intervalDays: 14,
  minDryDaysInRow: 1,
  tempRangeEnabled: false,
  minTempC: 10,
  maxTempC: 25,
};

export function taskFormValuesFromTask(task?: {
  title: string;
  intervalDays: number;
  weatherRules: HouseholdTaskWeatherRules;
}): TaskFormValues {
  if (!task) return DEFAULT_VALUES;
  const hasRange = task.weatherRules.minTempC !== undefined || task.weatherRules.maxTempC !== undefined;
  return {
    title: task.title,
    intervalDays: task.intervalDays,
    minDryDaysInRow: task.weatherRules.minDryDaysInRow,
    tempRangeEnabled: hasRange,
    minTempC: task.weatherRules.minTempC ?? DEFAULT_VALUES.minTempC,
    maxTempC: task.weatherRules.maxTempC ?? DEFAULT_VALUES.maxTempC,
  };
}

export function taskFormValuesToWeatherRules(values: TaskFormValues): HouseholdTaskWeatherRules {
  return {
    minDryDaysInRow: values.minDryDaysInRow,
    ...(values.tempRangeEnabled ? { minTempC: values.minTempC, maxTempC: values.maxTempC } : {}),
  };
}

export function TaskForm({
  eventId,
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
  submitError,
}: {
  eventId: string;
  initial?: TaskFormValues;
  onSubmit: (input: TaskInput) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  pending: boolean;
  submitError?: string | null;
}) {
  const [values, setValues] = useState<TaskFormValues>(initial ?? DEFAULT_VALUES);

  function update<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (values.tempRangeEnabled && values.minTempC > values.maxTempC) {
      return;
    }
    await onSubmit({
      eventId,
      title: values.title,
      intervalDays: values.intervalDays,
      weatherRules: taskFormValuesToWeatherRules(values),
    });
  }

  const rangeInvalid = values.tempRangeEnabled && values.minTempC > values.maxTempC;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Название
        </label>
        <input
          id="title"
          type="text"
          required
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="intervalDays" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Периодичность (дней)
        </label>
        <input
          id="intervalDays"
          type="number"
          min={1}
          required
          value={values.intervalDays}
          onChange={(e) => update("intervalDays", Number(e.target.value))}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex flex-col gap-1">
          <label htmlFor="minDryDaysInRow" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Минимум дней подряд без дождя
          </label>
          <input
            id="minDryDaysInRow"
            type="number"
            min={1}
            max={14}
            required
            value={values.minDryDaysInRow}
            onChange={(e) => update("minDryDaysInRow", Number(e.target.value))}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={values.tempRangeEnabled}
            onChange={(e) => update("tempRangeEnabled", e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
          />
          Ограничить температуру
        </label>

        {values.tempRangeEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="minTempC" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                От, °C
              </label>
              <input
                id="minTempC"
                type="number"
                required
                value={values.minTempC}
                onChange={(e) => update("minTempC", Number(e.target.value))}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="maxTempC" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                До, °C
              </label>
              <input
                id="maxTempC"
                type="number"
                required
                value={values.maxTempC}
                onChange={(e) => update("maxTempC", Number(e.target.value))}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          </div>
        )}
        {rangeInvalid && (
          <p className="text-xs text-red-600 dark:text-red-400">
            «От» не может быть больше «До»
          </p>
        )}
      </div>

      {submitError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {submitError}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending || rangeInvalid}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          {pending ? "Сохранение…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

export type { HouseholdTask };
