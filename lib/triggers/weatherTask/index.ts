import type { TriggerCheckContext, TriggerProvider } from "../types";
import { weatherTaskConfigSchema, type WeatherTaskConfig } from "./config";
import { todayDateString } from "./date";
import { evaluateTask } from "./logic";
import { fetchForecast, type DailyForecast } from "./openMeteo";
import { listTasksByEvent } from "./repository";
import { weatherRulesSchema } from "./taskRules";

export interface WeatherTaskRecommendation {
  taskId: string;
  title: string;
  reason: string;
}

export interface WeatherTaskStatus {
  taskId: string;
  title: string;
  due: boolean;
  triggered: boolean;
  reason: string | null;
}

export interface WeatherTaskPayload {
  status: "ok" | "no_tasks" | "error";
  message: string;
  location: WeatherTaskConfig["location"];
  forecastFetchedAt: string;
  // Форма payload'а, которую ожидает шаблон письма (lib/notifications/templates.ts):
  // несколько "созревших" одновременно работ объединяются в одну
  // рекомендацию/письмо (пункт 3 раздела 4.3 ТЗ), а не рассылаются по одной.
  recommendations: WeatherTaskRecommendation[];
  tasks: WeatherTaskStatus[];
}

function emptyPayload(
  status: "no_tasks" | "error",
  message: string,
  config: WeatherTaskConfig,
): WeatherTaskPayload {
  return {
    status,
    message,
    location: config.location,
    forecastFetchedAt: todayDateString(),
    recommendations: [],
    tasks: [],
  };
}

// Провайдер типа weather_task (раздел 4.3 ТЗ). Раз в сутки для каждой
// заведённой работы по дому проверяет: (а) прошло ли достаточно времени с
// последнего выполнения (периодичность); (б) есть ли в прогнозе Open-Meteo
// на 5-7 дней вперёд подходящее погодное окно. Никогда не бросает
// исключение из-за недоступности Open-Meteo — при ошибке возвращает
// status: "error" в payload, чтобы не ронять остальные события в общем
// cron-запуске (раздел 7 ТЗ).
export const weatherTaskProvider: TriggerProvider<WeatherTaskConfig> = {
  type: "weather_task",
  configSchema: weatherTaskConfigSchema,
  async check(config, context: TriggerCheckContext) {
    const tasks = await listTasksByEvent(context.eventId);

    if (tasks.length === 0) {
      return {
        triggered: false,
        payload: emptyPayload("no_tasks", "Нет ни одной заведённой работы по дому", config),
      };
    }

    let forecast: DailyForecast[];
    try {
      forecast = await fetchForecast(config.location, config.forecastDays);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        triggered: false,
        payload: emptyPayload("error", `Не удалось получить прогноз погоды: ${message}`, config),
      };
    }

    const today = todayDateString();
    const recommendations: WeatherTaskRecommendation[] = [];
    const taskStatuses: WeatherTaskStatus[] = [];

    for (const task of tasks) {
      const rules = weatherRulesSchema.parse(task.weatherRules);
      const evaluation = evaluateTask({
        lastDoneAt: task.lastDoneAt,
        intervalDays: task.intervalDays,
        weatherRules: rules,
        forecast,
        today,
      });

      taskStatuses.push({
        taskId: task.id,
        title: task.title,
        due: evaluation.due,
        triggered: evaluation.triggered,
        reason: evaluation.reason,
      });

      if (evaluation.triggered && evaluation.reason) {
        recommendations.push({ taskId: task.id, title: task.title, reason: evaluation.reason });
      }
    }

    return {
      triggered: recommendations.length > 0,
      payload: {
        status: "ok",
        message:
          recommendations.length > 0
            ? `Рекомендовано работ: ${recommendations.length}`
            : "Нет работ, готовых по срокам и погоде",
        location: config.location,
        forecastFetchedAt: today,
        recommendations,
        tasks: taskStatuses,
      } satisfies WeatherTaskPayload,
    };
  },
};
