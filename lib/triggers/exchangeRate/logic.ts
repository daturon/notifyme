// Точка временного ряда — одна запись rate_history (уже упрощённая до
// числа/даты, без деталей ORM), отсортирована по возрастанию recordedAt
// вызывающим кодом.
export interface RatePoint {
  recordedAt: string; // YYYY-MM-DD
  rate: number;
  sourceName: string;
}

export interface WindowStats {
  sufficient: boolean;
  accumulatedDays: number;
  requiredDays: number;
  average?: number;
  max?: number;
}

// Пункт 2.e/2.f задания: если истории меньше windowDays дней — не считаем
// среднее/максимум как основание для триггера, только сообщаем, сколько уже
// накоплено.
export function computeWindowStats(window: RatePoint[], requiredDays: number): WindowStats {
  const accumulatedDays = window.length;
  if (accumulatedDays < requiredDays) {
    return { sufficient: false, accumulatedDays, requiredDays };
  }

  const sum = window.reduce((total, point) => total + point.rate, 0);
  const average = sum / window.length;
  const max = Math.max(...window.map((point) => point.rate));

  return { sufficient: true, accumulatedDays, requiredDays, average, max };
}

export interface TriggerEvaluation {
  triggered: boolean;
  isWindowMax: boolean;
  exceedsThreshold: boolean;
  percentAboveAverage: number;
}

// Пункт 2.g задания: сегодняшний курс должен одновременно (1) быть
// максимумом за окно и (2) превышать среднее за окно минимум на threshold
// (доля, например 0.01 = 1%). today.rate по построению уже входит в
// window (вызывающий код кладёт в rate_history именно его), поэтому
// "today.rate === max за окно" эквивалентно "today.rate >= max за окно" —
// это позволяет обойтись без сравнения чисел с плавающей точкой на строгое
// равенство.
export function evaluateTrigger(todayRate: number, stats: WindowStats, threshold: number): TriggerEvaluation {
  if (!stats.sufficient || stats.average === undefined || stats.max === undefined) {
    return { triggered: false, isWindowMax: false, exceedsThreshold: false, percentAboveAverage: 0 };
  }

  const isWindowMax = todayRate >= stats.max;
  const percentAboveAverage = stats.average > 0 ? (todayRate - stats.average) / stats.average : 0;
  const exceedsThreshold = todayRate >= stats.average * (1 + threshold);

  return {
    triggered: isWindowMax && exceedsThreshold,
    isWindowMax,
    exceedsThreshold,
    percentAboveAverage,
  };
}

export type Trend = "up" | "down" | "flat" | "unknown";

// Пункт 2.h задания: тренд за последние 2 дня — только для текста письма,
// не влияет на triggered. "Растёт/падает 2-й день подряд" — обе
// день-к-дню разницы среди последних 3 точек (сегодня, вчера, позавчера)
// одного знака. Меньше 3 точек — тренд не определён.
export function computeTrend(window: RatePoint[]): Trend {
  const lastThree = window.slice(-3);
  if (lastThree.length < 3) return "unknown";

  const [dayBeforeYesterday, yesterday, today] = lastThree;
  const firstDelta = yesterday.rate - dayBeforeYesterday.rate;
  const secondDelta = today.rate - yesterday.rate;

  if (firstDelta > 0 && secondDelta > 0) return "up";
  if (firstDelta < 0 && secondDelta < 0) return "down";
  return "flat";
}
