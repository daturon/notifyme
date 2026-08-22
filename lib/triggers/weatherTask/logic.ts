import { daysBetween, formatInTimeZone } from "./date";
import type { DailyForecast, ForecastData, HourlyForecast } from "./openMeteo";
import type { DailyWeatherRules, WeatherRules, WorkWindowRules } from "./taskRules";

// Пункт 1.а раздела 4.3 ТЗ: прошло ли достаточно времени с последнего
// выполнения работы, с учётом периодичности. Без lastDoneAt работа ещё ни
// разу не выполнялась — считается созревшей сразу.
export function isTaskDue(lastDoneAt: string | null, intervalDays: number, today: string): boolean {
  if (!lastDoneAt) return true;
  return daysBetween(lastDoneAt, today) >= intervalDays;
}

export interface TaskEvaluation {
  due: boolean;
  window: FavorableWindow | FavorableWorkWindow | null;
  triggered: boolean;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// "daily" — периодические работы (покос, фасад): весь день оценивается
// целиком, важен только факт "сухо" и средняя температура за день.
// ---------------------------------------------------------------------------

// Порог "сухого" дня — Open-Meteo иногда возвращает следовые значения
// осадков (роса/туман в исходных данных модели), которые не мешают ни
// покосу, ни фасадным работам, поэтому не считаются дождём.
const DRY_DAY_MAX_PRECIPITATION_MM = 0.5;

export function isDayFavorable(day: DailyForecast, rules: DailyWeatherRules): boolean {
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
export function findFavorableWindow(forecast: DailyForecast[], rules: DailyWeatherRules): FavorableWindow | null {
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

function evaluateDailyTask(params: {
  lastDoneAt: string | null;
  intervalDays: number;
  weatherRules: DailyWeatherRules;
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

// ---------------------------------------------------------------------------
// "workWindow" — однодневная оценка "сколько часов сегодня/на неделе можно
// поработать": ветер, температура и осадки по часам, окно ограничено концом
// буднего дня (18:00 по умолчанию) или закатом, смотря что раньше; в
// выходные — только закатом.
// ---------------------------------------------------------------------------

// Порог осадков за час — меньше дневного (DRY_DAY_MAX_PRECIPITATION_MM),
// т.к. это накопление за один час, а не за сутки.
const DRY_HOUR_MAX_PRECIPITATION_MM = 0.2;

export function isHourFavorable(hour: HourlyForecast, rules: WorkWindowRules): boolean {
  if (hour.precipitationMm > DRY_HOUR_MAX_PRECIPITATION_MM) return false;
  if (hour.windSpeedKmh > rules.maxWindSpeedKmh) return false;
  if (rules.minTempC !== undefined && hour.temperatureC < rules.minTempC) return false;
  if (rules.maxTempC !== undefined && hour.temperatureC > rules.maxTempC) return false;
  return true;
}

export interface FavorableWorkWindow {
  date: string;
  startTime: string; // "YYYY-MM-DDTHH:MM"
  endTime: string; // exclusive, "YYYY-MM-DDTHH:MM"
  hours: number;
}

function addOneHour(timeStr: string): string {
  const [datePart, timePart] = timeStr.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d, hh + 1, mm));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}T${pad(next.getUTCHours())}:${pad(next.getUTCMinutes())}`;
}

// Ищет самый длинный непрерывный отрезок благоприятных часов среди уже
// обрезанных до рабочих границ дня почасовых точек (см. windowBoundsForDay).
export function findLongestFavorableRun(hours: HourlyForecast[], rules: WorkWindowRules): FavorableWorkWindow | null {
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;

  hours.forEach((hour, i) => {
    if (isHourFavorable(hour, rules)) {
      if (curLen === 0) curStart = i;
      curLen += 1;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curLen = 0;
    }
  });

  if (bestLen === 0) return null;

  const lastFavorable = hours[bestStart + bestLen - 1];
  return {
    date: hours[bestStart].time.slice(0, 10),
    startTime: hours[bestStart].time,
    endTime: addOneHour(lastFavorable.time),
    hours: bestLen,
  };
}

function isWeekend(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 || day === 6;
}

function padHour(hour: number): string {
  return String(hour).padStart(2, "0");
}

// Границы рабочего окна для конкретного дня: нижняя — dayStartHour (или
// текущее время, если это сегодня и оно позже dayStartHour), верхняя — закат
// в выходные, min(weekdayEndHour, закат) в будни (раздел из диалога с
// пользователем: "в будни по 18:00 или в выходные дни днём").
function windowBoundsForDay(params: {
  day: DailyForecast;
  rules: WorkWindowRules;
  isToday: boolean;
  nowLocal: string;
}): { startTime: string; endTime: string } {
  const { day, rules, isToday, nowLocal } = params;
  const weekend = isWeekend(day.date);

  const defaultStart = `${day.date}T${padHour(rules.dayStartHour)}:00`;
  const startTime = isToday && nowLocal > defaultStart ? nowLocal : defaultStart;

  const weekdayEnd = `${day.date}T${padHour(rules.weekdayEndHour)}:00`;
  const endTime = weekend ? day.sunset : weekdayEnd < day.sunset ? weekdayEnd : day.sunset;

  return { startTime, endTime };
}

function formatClock(timeStr: string): string {
  return timeStr.slice(11, 16);
}

// "3 ч" вместо "3.0 ч", но "2.5 ч" когда есть дробная часть.
function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export function buildWorkWindowReason(window: FavorableWorkWindow, isToday: boolean, dayEndTime: string): string {
  const dayLabel = isToday ? "сегодня" : formatShortDate(window.date);
  const untilDark = window.endTime >= dayEndTime ? " — как раз до конца окна" : "";
  return (
    `можно поработать ~${formatHours(window.hours)} ч ${dayLabel}, ` +
    `с ${formatClock(window.startTime)} до ${formatClock(window.endTime)}` +
    `${untilDark} (без дождя, ветер и температура в норме)`
  );
}

function evaluateWorkWindowTask(params: {
  lastDoneAt: string | null;
  intervalDays: number;
  rules: WorkWindowRules;
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  today: string;
  now: Date;
  timezone: string;
}): TaskEvaluation {
  const due = isTaskDue(params.lastDoneAt, params.intervalDays, params.today);
  if (!due) {
    return { due: false, window: null, triggered: false, reason: null };
  }

  const nowLocal = formatInTimeZone(params.now, params.timezone);

  for (const day of params.daily) {
    if (day.date < params.today) continue;
    const isToday = day.date === params.today;
    const { startTime, endTime } = windowBoundsForDay({ day, rules: params.rules, isToday, nowLocal });
    if (startTime >= endTime) continue; // no daylight/work time left for this day

    const hoursForDay = params.hourly.filter((hour) => hour.time >= startTime && hour.time < endTime);
    const favorable = findLongestFavorableRun(hoursForDay, params.rules);

    if (favorable && favorable.hours >= params.rules.minHours) {
      return {
        due: true,
        window: favorable,
        triggered: true,
        reason: buildWorkWindowReason(favorable, isToday, endTime),
      };
    }
  }

  return { due: true, window: null, triggered: false, reason: null };
}

// ---------------------------------------------------------------------------
// Диспетчер: выбирает daily- или workWindow-логику по rules.kind.
// ---------------------------------------------------------------------------

export function evaluateTask(params: {
  lastDoneAt: string | null;
  intervalDays: number;
  weatherRules: WeatherRules;
  forecast: ForecastData;
  today: string;
  now: Date;
}): TaskEvaluation {
  if (params.weatherRules.kind === "workWindow") {
    return evaluateWorkWindowTask({
      lastDoneAt: params.lastDoneAt,
      intervalDays: params.intervalDays,
      rules: params.weatherRules,
      daily: params.forecast.daily,
      hourly: params.forecast.hourly,
      today: params.today,
      now: params.now,
      timezone: params.forecast.timezone,
    });
  }

  return evaluateDailyTask({
    lastDoneAt: params.lastDoneAt,
    intervalDays: params.intervalDays,
    weatherRules: params.weatherRules,
    forecast: params.forecast.daily,
    today: params.today,
  });
}
