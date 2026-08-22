import { z } from "zod";

// Погодные условия-предпосылки для одной работы (раздел 4.3 ТЗ): "нет дождя
// последние/в ближайшие N дней подряд", опционально диапазон температуры.
// Форма на фронте всегда собирает этот объект из простых контролов
// (число + два поля температуры) — сырой JSON пользователю не показывается.
export const weatherRulesSchema = z
  .object({
    minDryDaysInRow: z.number().int().min(1).max(14).default(1),
    minTempC: z.number().min(-50).max(60).optional(),
    maxTempC: z.number().min(-50).max(60).optional(),
  })
  .refine(
    (rules) => rules.minTempC === undefined || rules.maxTempC === undefined || rules.minTempC <= rules.maxTempC,
    { message: "minTempC must be <= maxTempC" },
  );

export type WeatherRules = z.infer<typeof weatherRulesSchema>;

// Человекочитаемое описание условий для списка задач и писем (раздел 8,
// экран 3: "погодные условия человекочитаемо").
export function describeWeatherRules(rules: WeatherRules): string {
  const parts: string[] = [];

  parts.push(
    rules.minDryDaysInRow === 1
      ? "без дождя"
      : `минимум ${rules.minDryDaysInRow} дня подряд без дождя`,
  );

  if (rules.minTempC !== undefined && rules.maxTempC !== undefined) {
    parts.push(`температура ${rules.minTempC}–${rules.maxTempC}°C`);
  } else if (rules.minTempC !== undefined) {
    parts.push(`температура от ${rules.minTempC}°C`);
  } else if (rules.maxTempC !== undefined) {
    parts.push(`температура до ${rules.maxTempC}°C`);
  }

  return parts.join(", ");
}
