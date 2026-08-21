import type { z } from "zod";

// Единый интерфейс провайдера-триггера (раздел 7 ТЗ, "Расширяемость").
// Новый тип триггера — это новый модуль, реализующий этот интерфейс и
// зарегистрированный в реестре; ни API, ни Notification Engine менять не нужно.
export interface TriggerProvider<Config = unknown> {
  type: string;
  configSchema: z.ZodType<Config>;
  check(config: Config): Promise<TriggerCheckResult>;
}

export interface TriggerCheckResult {
  triggered: boolean;
  payload: unknown;
}
