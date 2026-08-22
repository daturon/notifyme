import { daysBetween } from "./date";
import type { DailyForecast } from "./openMeteo";
import type { WeatherRules } from "./taskRules";

// Порог "сухого" дня — Open-Meteo иногда возвращает следовые значения
// осадков (роса/туман в исходных данных модели), которые не мешают ни
// покосу, ни фасадным работам, поэтому не считаются дождём.
const DRY_DAY_MAX_PRECIPITATION_MM = 0.5;

export function isDayFavorable(day: DailyForecast, rules: WeatherRules): boolean {
  if (day.precipitationMm > DRY_DAY_MAX_PRECIPITATION_MM) return false;

  const meanTempC = (day.tempMaxC + day.tempMinC) / 2;
  if (rules.minTempC !== undefined && meanTempC < rules.minTempC) return false;
  if (rules.maxTempC !== undefined && meanTempC > rules.maxTempC) return false;

  return true;
}

export interface FavorableWindow {
  startDate: string;
  endDate: string;
  days: number;
  minTempC: number;
  maxTempC: number;
}

// Ищет самое раннее окно из подряд идущих благоприятных дней длиной
// rules.minDryDaysInRow (раздел 4.3 ТЗ: "нет дождя в ближайшие M дней
// подряд" — для фасадных работ важно именно окно, а не единичный день).
export function findFavorableWindow(forecast: DailyForecast[], rules: WeatherRules): FavorableWindow | null {
  const windowSize = rules.minDryDaysInRow;

  for (let start = 0; start + windowSize <= forecast.length; start += 1) {
    const slice = forecast.slice(start, start + windowSize);
    if (slice.every((day) => isDayFavorable(day, rules))) {
      const meanTemps = slice.map((day) => (day.tempMaxC + day.tempMinC) / 2);
      return {
        startDate: slice[0].date,
        endDate: slice[slice.length - 1].date,
        days: windowSize,
        minTempC: Math.round(Math.min(...meanTemps)),
        maxTempC: Math.round(Math.max(...meanTemps)),
      };
    }
  }

  return null;
}

// Пункт 1.а раздела 4.3 ТЗ: прошло ли достаточно времени с последнего
// выполнения работы, с учётом периодичности. Без lastDoneAt работа ещё ни
// разу не выполнялась — считается созревшей сразу.
export function isTaskDue(lastDoneAt: string | null, intervalDays: number, today: string): boolean {
  if (!lastDoneAt) return true;
  return daysBetween(lastDoneAt, today) >= intervalDays;
}

export interface TaskEvaluation {
  due: boolean;
  window: FavorableWindow | null;
  triggered: boolean;
  reason: string | null;
}

function formatShortDate(dateString: string): string {
  const [, month, day] = dateString.split("-");
  return `${day}.${month}`;
}

// Текст обоснования по примеру из раздела 4.3 ТЗ: "благоприятное окно
// 3 дня без дождя, 22–26°C".
export function buildReason(window: FavorableWindow): string {
  const dayLabel = window.days === 1 ? "1 день" : `${window.days} дня`;
  const dateSuffix = ` (с ${formatShortDate(window.startDate)})`;
  return `благоприятное окно ${dayLabel} без дождя, ${window.minTempC}–${window.maxTempC}°C${dateSuffix}`;
}

// Пункты 1-2 раздела 4.3 ТЗ: работа рекомендуется, только если она
// "созрела" по времени И погода благоприятна в ближайшем прогнозе.
export function evaluateTask(params: {
  lastDoneAt: string | null;
  intervalDays: number;
  weatherRules: WeatherRules;
  forecast: DailyForecast[];
  today: string;
}): TaskEvaluation {
  const due = isTaskDue(params.lastDoneAt, params.intervalDays, params.today);
  if (!due) {
    return { due: false, window: null, triggered: false, reason: null };
  }

  const window = findFavorableWindow(params.forecast, params.weatherRules);
  if (!window) {
    return { due: true, window: null, triggered: false, reason: null };
  }

  return { due: true, window, triggered: true, reason: buildReason(window) };
}
