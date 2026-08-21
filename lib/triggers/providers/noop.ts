import { z } from "zod";
import type { TriggerProvider } from "../types";

// Провайдер-заглушка для обкатки реестра/API до появления реальных типов
// триггеров (exchange_rate, weather_task). Всегда сообщает, что условие
// не выполнено.
const noopConfigSchema = z.object({}).catchall(z.unknown());

export const noopProvider: TriggerProvider<z.infer<typeof noopConfigSchema>> = {
  type: "noop",
  configSchema: noopConfigSchema,
  async check() {
    return { triggered: false, payload: null };
  },
};
