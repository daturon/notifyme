import type { WeatherTaskConfig } from "./config";

export interface DailyForecast {
  date: string; // YYYY-MM-DD
  precipitationMm: number;
  tempMaxC: number;
  tempMinC: number;
}

// Тот же бюджет времени, что и у источников курсов (раздел 7 ТЗ: лимит
// serverless-функции на Vercel Hobby) — оставляет запас, если cron проверяет
// несколько событий за один вызов.
export const FORECAST_FETCH_TIMEOUT_MS = 6000;

interface OpenMeteoDailyResponse {
  daily: {
    time: string[];
    precipitation_sum: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

// Open-Meteo (бесплатно, без API-ключа, без лимитов для non-commercial —
// раздел 2 ТЗ) — прогноз на config.forecastDays (5-7) дней вперёд по
// координатам события.
export async function fetchForecast(
  location: WeatherTaskConfig["location"],
  forecastDays: number,
): Promise<DailyForecast[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.lat));
  url.searchParams.set("longitude", String(location.lon));
  url.searchParams.set("daily", "precipitation_sum,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(forecastDays));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FORECAST_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as OpenMeteoDailyResponse;

    return data.daily.time.map((date, i) => ({
      date,
      precipitationMm: data.daily.precipitation_sum[i],
      tempMaxC: data.daily.temperature_2m_max[i],
      tempMinC: data.daily.temperature_2m_min[i],
    }));
  } finally {
    clearTimeout(timeout);
  }
}
