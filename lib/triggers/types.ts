import type { z } from "zod";

// Контекст запуска проверки — то, что провайдер не хранит в своём config,
// но может понадобиться для персистентности, специфичной для события
// (например, exchange_rate пишет/читает rate_history по eventId).
export interface TriggerCheckContext {
  eventId: string;
}

// Единый интерфейс провайдера-триггера (раздел 7 ТЗ, "Расширяемость").
// Новый тип триггера — это новый модуль, реализующий этот интерфейс и
// зарегистрированный в реестре; ни API, ни Notification Engine менять не нужно.
export interface TriggerProvider<Config = unknown> {
  type: string;
  configSchema: z.ZodType<Config>;
  check(config: Config, context: TriggerCheckContext): Promise<TriggerCheckResult>;
}

export interface TriggerCheckResult {
  triggered: boolean;
  payload: unknown;
}
