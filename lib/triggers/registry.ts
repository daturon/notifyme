import { noopProvider } from "./providers/noop";
import type { TriggerProvider } from "./types";

export type { TriggerProvider, TriggerCheckResult } from "./types";

const registry = new Map<string, TriggerProvider>();

function registerProvider(provider: TriggerProvider) {
  registry.set(provider.type, provider);
}

// Реальные провайдеры (exchange_rate, weather_task) добавятся здесь по мере
// реализации — регистрация остальных слоёв (API, cron) от этого не меняется.
registerProvider(noopProvider);

export function getProvider(type: string): TriggerProvider | undefined {
  return registry.get(type);
}

export function listProviderTypes(): string[] {
  return Array.from(registry.keys());
}
