import type { WeatherTaskConfig } from "./config";

export interface DailyForecast {
  date: string; // YYYY-MM-DD
  precipitationMm: number;
  tempMaxC: number;
  tempMinC: number;
  sunset: string; // "YYYY-MM-DDTHH:MM", local to the location (timezone=auto)
}

export interface HourlyForecast {
  time: string; // "YYYY-MM-DDTHH:MM", local to the location (timezone=auto)
  temperatureC: number;
  precipitationMm: number;
  windSpeedKmh: number;
}

export interface ForecastData {
  // IANA timezone name Open-Meteo resolved for these coordinates — needed to
  // work out "current hour" in the same local frame as hourly.time when
  // evaluating same-day work windows (see logic.ts).
  timezone: string;
  daily: DailyForecast[];
  hourly: HourlyForecast[];
}

// Тот же бюджет времени, что и у источников курсов (раздел 7 ТЗ: лимит
// serverless-функции на Vercel Hobby) — оставляет запас, если cron проверяет
// несколько событий за один вызов.
export const FORECAST_FETCH_TIMEOUT_MS = 6000;

interface OpenMeteoResponse {
  timezone: string;
  daily: {
    time: string[];
    precipitation_sum: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunset: string[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation: number[];
    wind_speed_10m: number[];
  };
}

// Open-Meteo (бесплатно, без API-ключа, без лимитов для non-commercial —
// раздел 2 ТЗ) — прогноз на config.forecastDays (5-7) дней вперёд по
// координатам события. Запрашивает и дневные, и почасовые переменные одним
// запросом: дневные нужны периодическим работам (раздел 4.3 ТЗ), почасовые
// (плюс закат) — для оценки "рабочего окна" в часах (ветер, время до
// темноты).
export async function fetchForecast(
  location: WeatherTaskConfig["location"],
  forecastDays: number,
): Promise<ForecastData> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.lat));
  url.searchParams.set("longitude", String(location.lon));
  url.searchParams.set("daily", "precipitation_sum,temperature_2m_max,temperature_2m_min,sunset");
  url.searchParams.set("hourly", "temperature_2m,precipitation,wind_speed_10m");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(forecastDays));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FORECAST_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as OpenMeteoResponse;

    return {
      timezone: data.timezone,
      daily: data.daily.time.map((date, i) => ({
        date,
        precipitationMm: data.daily.precipitation_sum[i],
        tempMaxC: data.daily.temperature_2m_max[i],
        tempMinC: data.daily.temperature_2m_min[i],
        sunset: data.daily.sunset[i],
      })),
      hourly: data.hourly.time.map((time, i) => ({
        time,
        temperatureC: data.hourly.temperature_2m[i],
        precipitationMm: data.hourly.precipitation[i],
        windSpeedKmh: data.hourly.wind_speed_10m[i],
      })),
    };
  } finally {
    clearTimeout(timeout);
  }
}
