import type { TriggerCheckContext, TriggerProvider } from "../types";
import { exchangeRateConfigSchema, type ExchangeRateConfig } from "./config";
import { todayDateString } from "./date";
import { fetchAllRates, type SourceFetchFailure } from "./fetchRates";
import { computeTrend, computeWindowStats, evaluateTrigger, type Trend, type WindowStats } from "./logic";
import { getRateHistoryWindow, upsertTodayRate } from "./repository";
import { buildInsufficientHistoryMessage, buildTriggeredMessage } from "./message";
import { sourceLabel } from "./sources";

export interface ExchangeRatePayload {
  status: "ok" | "insufficient_history" | "error";
  message: string;
  city: string;
  windowDays: number;
  thresholdPercent: number;
  today: { sourceId: string; sourceLabel: string; rate: number; recordedAt: string } | null;
  stats: WindowStats;
  isWindowMax?: boolean;
  exceedsThreshold?: boolean;
  percentAboveAverage?: number;
  trend?: Trend;
  sourceFailures: SourceFetchFailure[];
}

function errorPayload(message: string, config: ExchangeRateConfig, failures: SourceFetchFailure[]): ExchangeRatePayload {
  return {
    status: "error",
    message,
    city: config.city,
    windowDays: config.windowDays,
    thresholdPercent: config.thresholdPercent,
    today: null,
    stats: { sufficient: false, accumulatedDays: 0, requiredDays: config.windowDays },
    sourceFailures: failures,
  };
}

// Провайдер типа exchange_rate (раздел 4.2 ТЗ). Не сравнивает курс с
// фиксированным порогом — сравнивает сегодняшний лучший курс с историей за
// config.windowDays дней (локальный максимум окна + превышение среднего на
// threshold). Никогда не бросает исключение из-за недоступности источника
// (пункт 3 задания) — при полном отказе всех источников возвращает
// status: "error" в payload, а не throw, чтобы не ронять остальные события
// в общем cron-запуске.
export const exchangeRateProvider: TriggerProvider<ExchangeRateConfig> = {
  type: "exchange_rate",
  configSchema: exchangeRateConfigSchema,
  async check(config, context: TriggerCheckContext) {
    const { rates, failures } = await fetchAllRates();

    const trackedRates = rates.filter((rate) => config.sources.includes(rate.sourceId));
    if (trackedRates.length === 0) {
      const message =
        rates.length === 0
          ? `Не удалось получить курсы ни с одного источника: ${failures.map((f) => `${f.source} (${f.error})`).join("; ")}`
          : "Ни один из отслеживаемых пунктов не найден в ответе источника (возможно, изменился список источника)";
      return { triggered: false, payload: errorPayload(message, config, failures) };
    }

    const best = trackedRates.reduce((max, rate) => (rate.buyRatePer100 > max.buyRatePer100 ? rate : max));
    const recordedAt = todayDateString();

    await upsertTodayRate({
      eventId: context.eventId,
      sourceName: best.sourceId,
      rate: best.buyRatePer100,
      recordedAt,
    });

    const window = await getRateHistoryWindow(context.eventId, config.windowDays, recordedAt);
    const stats = computeWindowStats(window, config.windowDays);
    const today = {
      sourceId: best.sourceId,
      sourceLabel: sourceLabel(best.sourceId),
      rate: best.buyRatePer100,
      recordedAt,
    };

    if (!stats.sufficient) {
      return {
        triggered: false,
        payload: {
          status: "insufficient_history",
          message: buildInsufficientHistoryMessage(stats),
          city: config.city,
          windowDays: config.windowDays,
          thresholdPercent: config.thresholdPercent,
          today,
          stats,
          sourceFailures: failures,
        } satisfies ExchangeRatePayload,
      };
    }

    const evaluation = evaluateTrigger(best.buyRatePer100, stats, config.thresholdPercent);
    const trend = computeTrend(window);

    const message = buildTriggeredMessage({
      sourceLabel: today.sourceLabel,
      rate: today.rate,
      windowDays: config.windowDays,
      stats,
      evaluation,
      trend,
    });

    return {
      triggered: evaluation.triggered,
      payload: {
        status: "ok",
        message,
        city: config.city,
        windowDays: config.windowDays,
        thresholdPercent: config.thresholdPercent,
        today,
        stats,
        isWindowMax: evaluation.isWindowMax,
        exceedsThreshold: evaluation.exceedsThreshold,
        percentAboveAverage: evaluation.percentAboveAverage,
        trend,
        sourceFailures: failures,
      } satisfies ExchangeRatePayload,
    };
  },
};
