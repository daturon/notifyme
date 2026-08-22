import { z } from "zod";

// Погодные условия-предпосылки для одной работы (раздел 4.3 ТЗ). Два вида:
// - "daily" — периодическая работа, где неважен конкретный час (покос,
//   фасад): "нет дождя N дней подряд", опционально диапазон температуры.
// - "workWindow" — однодневная оценка "могу ли я сегодня/на неделе
//   поработать и сколько часов", завязанная на почасовой прогноз (ветер,
//   рабочее окно до заката/до конца буднего дня). Добавлено по запросу
//   пользователя: демонтаж короба на лесах — нужен не просто "подходящий
//   день", а конкретное число часов до темноты.
// Старые записи в БД без поля kind (созданные до этого расширения)
// интерпретируются как "daily" — см. preprocess ниже.
export const dailyWeatherRulesSchema = z
  .object({
    kind: z.literal("daily").default("daily"),
    minDryDaysInRow: z.number().int().min(1).max(14).default(1),
    minTempC: z.number().min(-50).max(60).optional(),
    maxTempC: z.number().min(-50).max(60).optional(),
  })
  .refine(
    (rules) => rules.minTempC === undefined || rules.maxTempC === undefined || rules.minTempC <= rules.maxTempC,
    { message: "minTempC must be <= maxTempC" },
  );

export const workWindowRulesSchema = z
  .object({
    kind: z.literal("workWindow"),
    // Комфортный диапазон температуры (опционально — если не важен).
    minTempC: z.number().min(-50).max(60).optional(),
    maxTempC: z.number().min(-50).max(60).optional(),
    // Порог "не сильного" ветра (Open-Meteo отдаёт скорость в км/ч по
    // умолчанию).
    maxWindSpeedKmh: z.number().min(0).max(150).default(30),
    // Минимальная длительность непрерывного благоприятного окна, чтобы
    // работа вообще имела смысл начинать.
    minHours: z.number().min(0.5).max(12).default(2),
    // Границы окна в будни — обычно вечер после работы (18:00-21:00 по
    // умолчанию). Верхняя граница фактически всегда min(weekdayEndHour,
    // закат) — окно не может длиться дольше светового дня.
    weekdayStartHour: z.number().int().min(0).max(23).default(18),
    weekdayEndHour: z.number().int().min(0).max(23).default(21),
    // Нижняя граница окна в выходные — весь день, окно идёт до заката (без
    // отдельного верхнего часа).
    weekendStartHour: z.number().int().min(0).max(23).default(8),
  })
  .refine((rules) => rules.weekdayStartHour < rules.weekdayEndHour, {
    message: "weekdayStartHour must be < weekdayEndHour",
  })
  .refine(
    (rules) => rules.minTempC === undefined || rules.maxTempC === undefined || rules.minTempC <= rules.maxTempC,
    { message: "minTempC must be <= maxTempC" },
  );

export const weatherRulesSchema = z.preprocess((value) => {
  if (value && typeof value === "object" && !("kind" in (value as Record<string, unknown>))) {
    return { ...(value as Record<string, unknown>), kind: "daily" };
  }
  return value;
}, z.union([dailyWeatherRulesSchema, workWindowRulesSchema]));

export type DailyWeatherRules = z.infer<typeof dailyWeatherRulesSchema>;
export type WorkWindowRules = z.infer<typeof workWindowRulesSchema>;
export type WeatherRules = z.infer<typeof weatherRulesSchema>;

// Человекочитаемое описание условий для списка задач и писем (раздел 8,
// экран 3: "погодные условия человекочитаемо").
export function describeWeatherRules(rules: WeatherRules): string {
  if (rules.kind === "workWindow") {
    const parts = [
      `минимум ${rules.minHours} ч подряд`,
      `ветер до ${rules.maxWindSpeedKmh} км/ч`,
      `будни ${rules.weekdayStartHour}:00–${rules.weekdayEndHour}:00`,
      "выходные — до заката",
    ];
    if (rules.minTempC !== undefined && rules.maxTempC !== undefined) {
      parts.push(`${rules.minTempC}–${rules.maxTempC}°C`);
    } else if (rules.minTempC !== undefined) {
      parts.push(`от ${rules.minTempC}°C`);
    } else if (rules.maxTempC !== undefined) {
      parts.push(`до ${rules.maxTempC}°C`);
    }
    return parts.join(", ");
  }

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
