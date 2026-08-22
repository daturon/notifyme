"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import {
  TaskForm,
  taskFormValuesFromTask,
  type TaskFormValues,
} from "@/components/TaskForm";
import { ApiClientError, getEvent } from "@/lib/api/events";
import {
  createTask,
  deleteTask,
  listTasks,
  markTaskDone,
  updateTask,
  type HouseholdTask,
  type TaskInput,
} from "@/lib/api/tasks";
import { TASK_PRESETS } from "@/lib/triggers/weatherTask/presets";
import { describeWeatherRules } from "@/lib/triggers/weatherTask/taskRules";

function formatDate(iso: string | null) {
  if (!iso) return "ни разу";
  return new Date(iso).toLocaleDateString("ru-RU");
}

// Приблизительная оценка для UI ("просрочена / в графике") на основе
// часового пояса браузера — источник истины остаётся за провайдером
// weather_task, который считает то же самое по локальной дате события
// (lib/triggers/weatherTask/logic.ts, isTaskDue).
function isOverdue(task: HouseholdTask): boolean {
  if (!task.lastDoneAt) return true;
  const last = new Date(task.lastDoneAt);
  const diffDays = Math.floor((Date.now() - last.getTime()) / 86_400_000);
  return diffDays >= task.intervalDays;
}

export default function EventTasksPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const queryClient = useQueryClient();

  const [modal, setModal] = useState<{ mode: "add"; initial?: TaskFormValues } | { mode: "edit"; task: HouseholdTask } | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const eventQuery = useQuery({ queryKey: ["events", eventId], queryFn: () => getEvent(eventId) });
  const tasksQuery = useQuery({
    queryKey: ["tasks", eventId],
    queryFn: () => listTasks(eventId),
  });

  function invalidateTasks() {
    queryClient.invalidateQueries({ queryKey: ["tasks", eventId] });
  }

  const createMutation = useMutation({
    mutationFn: (input: TaskInput) => createTask(input),
    onSuccess: () => {
      invalidateTasks();
      setModal(null);
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : "Не удалось сохранить задачу");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Omit<TaskInput, "eventId">> }) => updateTask(id, input),
    onSuccess: () => {
      invalidateTasks();
      setModal(null);
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : "Не удалось сохранить задачу");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: invalidateTasks,
  });

  const doneMutation = useMutation({
    mutationFn: (id: string) => markTaskDone(id),
    onSuccess: invalidateTasks,
  });

  const event = eventQuery.data?.event;
  const isWeatherTask = event?.type === "weather_task";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Задачи по дому{event ? `: ${event.name}` : ""}
        </h1>
        <Link href="/events" className="text-sm text-zinc-500 hover:underline">
          ← к списку
        </Link>
      </div>

      {eventQuery.isLoading && <p className="text-sm text-zinc-500">Загрузка…</p>}

      {event && !isWeatherTask && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Это событие не типа weather_task — экран задач применим только к погодным событиям.
        </p>
      )}

      {isWeatherTask && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setFormError(null);
                setModal({ mode: "add" });
              }}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
            >
              + Своя задача
            </button>
            {TASK_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setFormError(null);
                  createMutation.mutate({
                    eventId,
                    title: preset.title,
                    intervalDays: preset.intervalDays,
                    weatherRules: preset.weatherRules,
                  });
                }}
                disabled={createMutation.isPending}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                + {preset.title}
              </button>
            ))}
          </div>

          {tasksQuery.isLoading && <p className="text-sm text-zinc-500">Загрузка задач…</p>}

          {tasksQuery.isError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              Не удалось загрузить задачи
            </p>
          )}

          {tasksQuery.data && tasksQuery.data.tasks.length === 0 && (
            <p className="text-sm text-zinc-500">Задач пока нет — добавьте первую вручную или по шаблону.</p>
          )}

          <div className="flex flex-col gap-3">
            {tasksQuery.data?.tasks.map((task) => {
              const overdue = isOverdue(task);
              return (
                <div
                  key={task.id}
                  className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-black dark:text-zinc-50">{task.title}</h3>
                      <p className="text-xs text-zinc-500">
                        раз в {task.intervalDays} дн. · {describeWeatherRules(task.weatherRules)}
                      </p>
                    </div>
                    <span
                      className={
                        overdue
                          ? "shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      }
                    >
                      {overdue ? "просрочена" : "в графике"}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500">Последнее выполнение: {formatDate(task.lastDoneAt)}</p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => doneMutation.mutate(task.id)}
                      disabled={doneMutation.isPending}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Отметить выполненным
                    </button>
                    <button
                      onClick={() => {
                        setFormError(null);
                        setModal({ mode: "edit", task });
                      }}
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(task.id)}
                      disabled={deleteMutation.isPending}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {modal && (
        <Modal
          title={modal.mode === "add" ? "Новая задача" : "Редактирование задачи"}
          onClose={() => setModal(null)}
        >
          <TaskForm
            eventId={eventId}
            initial={modal.mode === "edit" ? taskFormValuesFromTask(modal.task) : modal.initial}
            submitLabel={modal.mode === "add" ? "Добавить" : "Сохранить"}
            pending={createMutation.isPending || updateMutation.isPending}
            submitError={formError}
            onCancel={() => setModal(null)}
            onSubmit={async (input) => {
              setFormError(null);
              if (modal.mode === "add") {
                await createMutation.mutateAsync(input);
              } else {
                await updateMutation.mutateAsync({
                  id: modal.task.id,
                  input: { title: input.title, intervalDays: input.intervalDays, weatherRules: input.weatherRules },
                });
              }
            }}
          />
        </Modal>
      )}
    </div>
  );
}
