import { exchangeRateProvider } from "./exchangeRate";
import { noopProvider } from "./providers/noop";
import type { TriggerProvider } from "./types";
import { weatherTaskProvider } from "./weatherTask";

export type { TriggerProvider, TriggerCheckResult, TriggerCheckContext } from "./types";

const registry = new Map<string, TriggerProvider>();

function registerProvider(provider: TriggerProvider) {
  registry.set(provider.type, provider);
}

// Новые типы триггеров регистрируются здесь — остальные слои (API, cron,
// Notification Engine) от этого не меняются (раздел 7 ТЗ, "Расширяемость").
registerProvider(noopProvider);
registerProvider(exchangeRateProvider);
registerProvider(weatherTaskProvider);

export function getProvider(type: string): TriggerProvider | undefined {
  return registry.get(type);
}

export function listProviderTypes(): string[] {
  return Array.from(registry.keys());
}
