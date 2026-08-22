"use client";

import { useState } from "react";
import type { HouseholdTask, HouseholdTaskWeatherRules, TaskInput } from "@/lib/api/tasks";

// Форма добавления/редактирования задачи (раздел 8, экран 3 ТЗ): понятные
// поля вместо сырого JSON. Два вида условий:
// - "daily" — периодическая работа (покос, фасад): минимум N дней подряд
//   без дождя, опционально диапазон температуры;
// - "workWindow" — оценка "сколько часов сегодня/на неделе можно
//   поработать" по часам: ветер, температура, рабочее окно до конца
//   буднего дня/заката.
export interface TaskFormValues {
  title: string;
  intervalDays: number;
  kind: "daily" | "workWindow";
  // daily
  minDryDaysInRow: number;
  // общие для обоих видов
  tempRangeEnabled: boolean;
  minTempC: number;
  maxTempC: number;
  // workWindow
  maxWindSpeedKmh: number;
  minHours: number;
  weekdayEndHour: number;
  dayStartHour: number;
}

const DEFAULT_VALUES: TaskFormValues = {
  title: "",
  intervalDays: 14,
  kind: "daily",
  minDryDaysInRow: 1,
  tempRangeEnabled: false,
  minTempC: 10,
  maxTempC: 25,
  maxWindSpeedKmh: 30,
  minHours: 2,
  weekdayEndHour: 18,
  dayStartHour: 8,
};

export function taskFormValuesFromTask(task?: {
  title: string;
  intervalDays: number;
  weatherRules: HouseholdTaskWeatherRules;
}): TaskFormValues {
  if (!task) return DEFAULT_VALUES;
  const rules = task.weatherRules;

  if (rules.kind === "workWindow") {
    const hasRange = rules.minTempC !== undefined || rules.maxTempC !== undefined;
    return {
      ...DEFAULT_VALUES,
      title: task.title,
      intervalDays: task.intervalDays,
      kind: "workWindow",
      tempRangeEnabled: hasRange,
      minTempC: rules.minTempC ?? DEFAULT_VALUES.minTempC,
      maxTempC: rules.maxTempC ?? DEFAULT_VALUES.maxTempC,
      maxWindSpeedKmh: rules.maxWindSpeedKmh,
      minHours: rules.minHours,
      weekdayEndHour: rules.weekdayEndHour,
      dayStartHour: rules.dayStartHour,
    };
  }

  const hasRange = rules.minTempC !== undefined || rules.maxTempC !== undefined;
  return {
    ...DEFAULT_VALUES,
    title: task.title,
    intervalDays: task.intervalDays,
    kind: "daily",
    minDryDaysInRow: rules.minDryDaysInRow,
    tempRangeEnabled: hasRange,
    minTempC: rules.minTempC ?? DEFAULT_VALUES.minTempC,
    maxTempC: rules.maxTempC ?? DEFAULT_VALUES.maxTempC,
  };
}

export function taskFormValuesToWeatherRules(values: TaskFormValues): HouseholdTaskWeatherRules {
  const tempRange = values.tempRangeEnabled ? { minTempC: values.minTempC, maxTempC: values.maxTempC } : {};

  if (values.kind === "workWindow") {
    return {
      kind: "workWindow",
      maxWindSpeedKmh: values.maxWindSpeedKmh,
      minHours: values.minHours,
      weekdayEndHour: values.weekdayEndHour,
      dayStartHour: values.dayStartHour,
      ...tempRange,
    };
  }

  return {
    kind: "daily",
    minDryDaysInRow: values.minDryDaysInRow,
    ...tempRange,
  };
}

function inputClass() {
  return "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
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
          className={inputClass()}
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
          className={inputClass()}
        />
        {values.kind === "workWindow" && (
          <p className="text-xs text-zinc-500">
            Для разового проекта на несколько сессий обычно достаточно 1 — рекомендация будет приходить
            каждый день, пока вы не отметите задачу выполненной.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Тип погодных условий</span>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="radio"
              name="kind"
              checked={values.kind === "daily"}
              onChange={() => update("kind", "daily")}
              className="h-4 w-4 border-zinc-300 dark:border-zinc-700"
            />
            Периодическая работа (по дням)
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="radio"
              name="kind"
              checked={values.kind === "workWindow"}
              onChange={() => update("kind", "workWindow")}
              className="h-4 w-4 border-zinc-300 dark:border-zinc-700"
            />
            Рабочее окно (по часам)
          </label>
        </div>
      </div>

      {values.kind === "daily" ? (
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
              className={inputClass()}
            />
          </div>

          <TempRangeControl values={values} update={update} rangeInvalid={rangeInvalid} />
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="minHours" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Минимум часов подряд
              </label>
              <input
                id="minHours"
                type="number"
                min={0.5}
                step={0.5}
                required
                value={values.minHours}
                onChange={(e) => update("minHours", Number(e.target.value))}
                className={inputClass()}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="maxWindSpeedKmh" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Ветер не более, км/ч
              </label>
              <input
                id="maxWindSpeedKmh"
                type="number"
                min={0}
                required
                value={values.maxWindSpeedKmh}
                onChange={(e) => update("maxWindSpeedKmh", Number(e.target.value))}
                className={inputClass()}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="dayStartHour" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Начало окна, час
              </label>
              <input
                id="dayStartHour"
                type="number"
                min={0}
                max={23}
                required
                value={values.dayStartHour}
                onChange={(e) => update("dayStartHour", Number(e.target.value))}
                className={inputClass()}
              />
              <p className="text-xs text-zinc-500">Для будущих дней; сегодня окно начинается с текущего часа.</p>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="weekdayEndHour" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Конец окна в будни, час
              </label>
              <input
                id="weekdayEndHour"
                type="number"
                min={0}
                max={23}
                required
                value={values.weekdayEndHour}
                onChange={(e) => update("weekdayEndHour", Number(e.target.value))}
                className={inputClass()}
              />
              <p className="text-xs text-zinc-500">В выходные окно идёт до заката.</p>
            </div>
          </div>

          <TempRangeControl values={values} update={update} rangeInvalid={rangeInvalid} />
        </div>
      )}

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

function TempRangeControl({
  values,
  update,
  rangeInvalid,
}: {
  values: TaskFormValues;
  update: <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) => void;
  rangeInvalid: boolean;
}) {
  return (
    <>
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
              className={inputClass()}
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
              className={inputClass()}
            />
          </div>
        </div>
      )}
      {rangeInvalid && <p className="text-xs text-red-600 dark:text-red-400">«От» не может быть больше «До»</p>}
    </>
  );
}

export type { HouseholdTask };
