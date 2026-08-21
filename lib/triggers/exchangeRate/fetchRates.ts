import { parseMyfinRates, type ParsedBankRate } from "./parseMyfin";
import { ZHLOBIN_RUB_URL } from "./sources";

// Один источник курсов — сейчас единственный (агрегатор myfin.by), но
// оформлен как список, чтобы задание 2.a ("параллельно, Promise.all") имело
// смысл и чтобы добавление источника (например, сайта конкретного банка)
// не требовало переписывать check() — только добавить сюда ещё один fetcher.
interface RateSource {
  name: string;
  url: string;
  fetchRates: (html: string) => ParsedBankRate[];
}

const RATE_SOURCES: RateSource[] = [
  { name: "myfin.by", url: ZHLOBIN_RUB_URL, fetchRates: parseMyfinRates },
];

// Лимит одного запроса. Vercel Hobby даёт 10с на всю serverless-функцию —
// cron может проверять несколько событий за один вызов, поэтому здесь
// оставлен запас, а не выбраны все 10с под один запрос.
export const SOURCE_FETCH_TIMEOUT_MS = 6000;

export interface SourceFetchFailure {
  source: string;
  error: string;
}

export interface FetchAllRatesResult {
  rates: ParsedBankRate[];
  failures: SourceFetchFailure[];
}

async function fetchOneSource(source: RateSource): Promise<ParsedBankRate[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(source.url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    return source.fetchRates(html);
  } finally {
    clearTimeout(timeout);
  }
}

// Получает курсы со всех источников параллельно (Promise.all/allSettled —
// пункт 2.a задания), с таймаутом на каждый запрос. Ни один упавший или
// недоступный источник не приводит к исключению — только к записи в
// failures (пункт 3 задания: событие не должно ронять весь cron).
export async function fetchAllRates(): Promise<FetchAllRatesResult> {
  const settled = await Promise.allSettled(RATE_SOURCES.map((source) => fetchOneSource(source)));

  const rates: ParsedBankRate[] = [];
  const failures: SourceFetchFailure[] = [];

  settled.forEach((result, index) => {
    const source = RATE_SOURCES[index];
    if (result.status === "fulfilled") {
      if (result.value.length === 0) {
        failures.push({ source: source.name, error: "Источник вернул 0 курсов (формат страницы мог измениться)" });
      } else {
        rates.push(...result.value);
      }
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failures.push({ source: source.name, error: message });
    }
  });

  return { rates, failures };
}
