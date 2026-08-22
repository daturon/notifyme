// Тонкий клиент поверх REST API из app/api/tasks — тот же принцип, что и
// lib/api/events.ts.
import { ApiClientError } from "./events";

export interface HouseholdTaskWeatherRules {
  minDryDaysInRow: number;
  minTempC?: number;
  maxTempC?: number;
}

export interface HouseholdTask {
  id: string;
  eventId: string;
  title: string;
  intervalDays: number;
  weatherRules: HouseholdTaskWeatherRules;
  lastDoneAt: string | null;
  createdAt: string;
}

export interface TaskInput {
  eventId: string;
  title: string;
  intervalDays: number;
  weatherRules: HouseholdTaskWeatherRules;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiClientError(body.error ?? `Request failed: ${response.status}`, response.status, body.issues);
  }

  return response.json();
}

export function listTasks(eventId: string): Promise<{ tasks: HouseholdTask[] }> {
  return request(`/api/tasks?eventId=${encodeURIComponent(eventId)}`);
}

export function createTask(input: TaskInput): Promise<{ task: HouseholdTask }> {
  return request("/api/tasks", { method: "POST", body: JSON.stringify(input) });
}

export function updateTask(
  id: string,
  input: Partial<Omit<TaskInput, "eventId">>,
): Promise<{ task: HouseholdTask }> {
  return request(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteTask(id: string): Promise<{ success: true }> {
  return request(`/api/tasks/${id}`, { method: "DELETE" });
}

export function markTaskDone(id: string): Promise<{ task: HouseholdTask }> {
  return request(`/api/tasks/${id}/done`, { method: "POST" });
}
