"use client";

import { KNOWN_BANK_SOURCES } from "@/lib/triggers/exchangeRate/sources";

// Форма конфигурации для типа exchange_rate (вместо сырого JSON, пункт 4
// задания). thresholdPercent в UI хранится как число процентов (1 = 1%) для
// удобства ввода — в config уходит как доля (0.01), см. toEventConfig ниже.
export interface ExchangeRateFormConfig {
  city: string;
  windowDays: number;
  thresholdPercentInput: number;
  sources: string[];
}

export const DEFAULT_EXCHANGE_RATE_FORM_CONFIG: ExchangeRateFormConfig = {
  city: "Жлобин",
  windowDays: 14,
  thresholdPercentInput: 1,
  sources: KNOWN_BANK_SOURCES.map((source) => source.id),
};

export function exchangeRateFormConfigFromEventConfig(config: unknown): ExchangeRateFormConfig {
  if (!config || typeof config !== "object") return DEFAULT_EXCHANGE_RATE_FORM_CONFIG;
  const c = config as Record<string, unknown>;
  return {
    city: typeof c.city === "string" ? c.city : DEFAULT_EXCHANGE_RATE_FORM_CONFIG.city,
    windowDays: typeof c.windowDays === "number" ? c.windowDays : DEFAULT_EXCHANGE_RATE_FORM_CONFIG.windowDays,
    thresholdPercentInput:
      typeof c.thresholdPercent === "number"
        ? c.thresholdPercent * 100
        : DEFAULT_EXCHANGE_RATE_FORM_CONFIG.thresholdPercentInput,
    sources: Array.isArray(c.sources) && c.sources.every((s) => typeof s === "string")
      ? (c.sources as string[])
      : DEFAULT_EXCHANGE_RATE_FORM_CONFIG.sources,
  };
}

export function exchangeRateFormConfigToEventConfig(value: ExchangeRateFormConfig) {
  return {
    city: value.city,
    windowDays: value.windowDays,
    thresholdPercent: value.thresholdPercentInput / 100,
    sources: value.sources,
  };
}

export function ExchangeRateConfigForm({
  value,
  onChange,
}: {
  value: ExchangeRateFormConfig;
  onChange: (value: ExchangeRateFormConfig) => void;
}) {
  function update<K extends keyof ExchangeRateFormConfig>(key: K, next: ExchangeRateFormConfig[K]) {
    onChange({ ...value, [key]: next });
  }

  function toggleSource(id: string, checked: boolean) {
    update("sources", checked ? [...value.sources, id] : value.sources.filter((s) => s !== id));
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-col gap-1">
        <label htmlFor="city" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Город
        </label>
        <input
          id="city"
          type="text"
          required
          value={value.city}
          onChange={(e) => update("city", e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="windowDays" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Окно сравнения (дней)
          </label>
          <input
            id="windowDays"
            type="number"
            min={2}
            required
            value={value.windowDays}
            onChange={(e) => update("windowDays", Number(e.target.value))}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="thresholdPercent" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Порог над средним (%)
          </label>
          <input
            id="thresholdPercent"
            type="number"
            min={0}
            step={0.1}
            required
            value={value.thresholdPercentInput}
            onChange={(e) => update("thresholdPercentInput", Number(e.target.value))}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Отслеживаемые пункты</span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
          {KNOWN_BANK_SOURCES.map((source) => (
            <label key={source.id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={value.sources.includes(source.id)}
                onChange={(e) => toggleSource(source.id, e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
              />
              {source.label}
            </label>
          ))}
        </div>
        {value.sources.length === 0 && (
          <p className="text-xs text-red-600 dark:text-red-400">Выберите хотя бы один пункт</p>
        )}
      </div>
    </div>
  );
}
