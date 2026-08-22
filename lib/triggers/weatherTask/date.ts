// Тот же принцип, что и в lib/triggers/exchangeRate/date.ts (раздел 9 п.5
// ТЗ): "сегодня" считается по локальному часовому поясу пользователя, а не
// по UTC-дате сервера, чтобы вечером по местному времени не промахнуться
// мимо календарного дня.
const TIME_ZONE = "Europe/Minsk";

export function todayDateString(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now); // en-CA -> YYYY-MM-DD
}

function toUtcTimestamp(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

// Разница в календарных днях между двумя YYYY-MM-DD датами (сравнение
// как дат, а не как timestamptz — без риска расхождения из-за DST).
export function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((toUtcTimestamp(toDate) - toUtcTimestamp(fromDate)) / 86_400_000);
}

// "Сейчас" в часовом поясе локации события (а не сервера) — Open-Meteo
// отдаёт почасовой прогноз в наивном локальном времени этой локации
// (timezone=auto), поэтому для сравнения "сколько часов осталось до конца
// рабочего окна сегодня" нужно то же самое время, а не UTC/Europe-Minsk
// сервера. Формат совпадает с hourly.time из ответа Open-Meteo:
// "YYYY-MM-DDTHH:MM".
export function formatInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
