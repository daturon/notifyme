import type { WeatherRules } from "./taskRules";

export interface TaskPreset {
  id: string;
  title: string;
  intervalDays: number;
  weatherRules: WeatherRules;
}

// Готовые шаблоны типовых работ (раздел 9 п.3, задание к разделу 4.3 п.4
// ТЗ) — разумные дефолты, которые добавляют задачу в один клик; детали
// (периодичность, диапазон температуры) можно тут же поправить в форме.
export const TASK_PRESETS: TaskPreset[] = [
  {
    id: "mowing",
    title: "Покос травы",
    intervalDays: 14,
    weatherRules: { minDryDaysInRow: 1, minTempC: 12, maxTempC: 28 },
  },
  {
    id: "facade",
    title: "Фасадные работы",
    intervalDays: 180,
    // Фасадным работам нужно окно сухой погоды в несколько дней подряд
    // (раздел 4.3 ТЗ, пример именно про этот случай), а не один сухой день.
    weatherRules: { minDryDaysInRow: 3, minTempC: 15, maxTempC: 30 },
  },
  {
    id: "wood-treatment",
    title: "Обработка дерева (антисептик/масло)",
    intervalDays: 365,
    weatherRules: { minDryDaysInRow: 2, minTempC: 10, maxTempC: 25 },
  },
];
