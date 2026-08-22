"use client";

// Форма конфигурации для типа weather_task (вместо сырого JSON) — координаты
// локации и глубина прогноза (раздел 8 ТЗ, промпт 5: "визуальные формы под
// конкретные типы"). Координаты, а не геокодирование по названию — выбор
// объяснён в lib/triggers/weatherTask/config.ts.
export interface WeatherTaskFormConfig {
  lat: number;
  lon: number;
  label: string;
  forecastDays: number;
}

export const DEFAULT_WEATHER_TASK_FORM_CONFIG: WeatherTaskFormConfig = {
  lat: 52.888,
  lon: 30.041,
  label: "",
  forecastDays: 7,
};

export function weatherTaskFormConfigFromEventConfig(config: unknown): WeatherTaskFormConfig {
  if (!config || typeof config !== "object") return DEFAULT_WEATHER_TASK_FORM_CONFIG;
  const c = config as Record<string, unknown>;
  const location = (c.location && typeof c.location === "object" ? c.location : {}) as Record<string, unknown>;

  return {
    lat: typeof location.lat === "number" ? location.lat : DEFAULT_WEATHER_TASK_FORM_CONFIG.lat,
    lon: typeof location.lon === "number" ? location.lon : DEFAULT_WEATHER_TASK_FORM_CONFIG.lon,
    label: typeof location.label === "string" ? location.label : DEFAULT_WEATHER_TASK_FORM_CONFIG.label,
    forecastDays:
      typeof c.forecastDays === "number" ? c.forecastDays : DEFAULT_WEATHER_TASK_FORM_CONFIG.forecastDays,
  };
}

export function weatherTaskFormConfigToEventConfig(value: WeatherTaskFormConfig) {
  return {
    location: {
      lat: value.lat,
      lon: value.lon,
      ...(value.label.trim() ? { label: value.label.trim() } : {}),
    },
    forecastDays: value.forecastDays,
  };
}

export function WeatherTaskConfigForm({
  value,
  onChange,
}: {
  value: WeatherTaskFormConfig;
  onChange: (value: WeatherTaskFormConfig) => void;
}) {
  function update<K extends keyof WeatherTaskFormConfig>(key: K, next: WeatherTaskFormConfig[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-col gap-1">
        <label htmlFor="locationLabel" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Название локации (необязательно)
        </label>
        <input
          id="locationLabel"
          type="text"
          placeholder="Например: Жлобин, дача"
          value={value.label}
          onChange={(e) => update("label", e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <p className="text-xs text-zinc-500">Только для отображения — на прогноз не влияет.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="lat" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Широта
          </label>
          <input
            id="lat"
            type="number"
            step="any"
            min={-90}
            max={90}
            required
            value={value.lat}
            onChange={(e) => update("lat", Number(e.target.value))}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="lon" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Долгота
          </label>
          <input
            id="lon"
            type="number"
            step="any"
            min={-180}
            max={180}
            required
            value={value.lon}
            onChange={(e) => update("lon", Number(e.target.value))}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Координаты можно взять с любой карты (например, долгое нажатие на точке в Google Maps покажет
        широту/долготу).
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="forecastDays" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Глубина прогноза (дней)
        </label>
        <input
          id="forecastDays"
          type="number"
          min={5}
          max={7}
          required
          value={value.forecastDays}
          onChange={(e) => update("forecastDays", Number(e.target.value))}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>
    </div>
  );
}
