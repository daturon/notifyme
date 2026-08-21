// Курсы обмена — локальное для Жлобина (Беларусь) понятие "сегодня", а не
// UTC-дата сервера (Vercel cron/serverless-функции работают в UTC — раздел 9
// п.5 ТЗ). Если считать "сегодня" по UTC, вечером по местному времени можно
// записать курс не под тем днём.
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

export function subtractDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
