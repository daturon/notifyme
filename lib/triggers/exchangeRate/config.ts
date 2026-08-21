import { z } from "zod";
import { DEFAULT_TRACKED_SOURCE_IDS, KNOWN_BANK_SOURCES } from "./sources";

const knownSourceIds = KNOWN_BANK_SOURCES.map((source) => source.id) as [string, ...string[]];

// Параметры конфигурации по разделу 4.2 ТЗ. city оставлен полем (а не
// хардкодом), чтобы форма/схема были готовы к другим городам (раздел 4.2,
// "поле должно быть готово к расширению"), хотя на MVP источник данных
// (myfin.by/currency/rub/<город>) поддерживает только Жлобин.
export const exchangeRateConfigSchema = z.object({
  city: z.string().trim().min(1).default("Жлобин"),
  sources: z.array(z.enum(knownSourceIds)).min(1).default(DEFAULT_TRACKED_SOURCE_IDS),
  windowDays: z.number().int().positive().default(14),
  // доля, не проценты: 0.01 = 1% (раздел 4.2, "порог превышения над средним")
  thresholdPercent: z.number().min(0).default(0.01),
  minAmount: z.number().positive().optional(),
});

export type ExchangeRateConfig = z.infer<typeof exchangeRateConfigSchema>;
