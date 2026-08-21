import type { Trend, TriggerEvaluation, WindowStats } from "./logic";

const TREND_TEXT: Record<Trend, string> = {
  up: "рост 2-й день подряд",
  down: "падение 2-й день подряд",
  flat: "без изменений",
  unknown: "недостаточно данных",
};

// Текст письма по разделу 4.2 п.5 ТЗ: "Лучший курс сегодня: [банк/пункт],
// [курс], на X% выше среднего за 14 дней, [является/не является] максимумом
// за этот период, тренд последних 2 дней: [рост/падение/без изменений]".
export function buildTriggeredMessage(params: {
  sourceLabel: string;
  rate: number;
  windowDays: number;
  stats: WindowStats;
  evaluation: TriggerEvaluation;
  trend: Trend;
}): string {
  const percent = (params.evaluation.percentAboveAverage * 100).toFixed(1);
  const maxText = params.evaluation.isWindowMax ? "является" : "не является";

  return (
    `Лучший курс сегодня: ${params.sourceLabel}, ${params.rate} BYN за 100 RUB, ` +
    `на ${percent}% выше среднего за ${params.windowDays} дней, ${maxText} максимумом за этот период, ` +
    `тренд последних 2 дней: ${TREND_TEXT[params.trend]}.`
  );
}

export function buildInsufficientHistoryMessage(stats: WindowStats): string {
  return `Недостаточно истории для оценки, накоплено ${stats.accumulatedDays} из ${stats.requiredDays} дней.`;
}
