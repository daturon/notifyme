// Тонкий клиент поверх REST API из app/api/events — используется хуками
// React Query на фронтенде. Даты с сервера приходят строками (JSON), поэтому
// типы здесь описывают именно "сериализованную" форму, а не Drizzle-строки.

export type EventType = string;

export interface Event {
  id: string;
  name: string;
  type: EventType;
  config: unknown;
  isActive: boolean;
  recipientEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface RunLogEntry {
  id: string;
  eventId: string;
  ranAt: string;
  triggered: boolean;
  rawResult: unknown;
}

export interface NotificationLogEntry {
  id: string;
  eventId: string;
  sentAt: string;
  subject: string | null;
  body: string | null;
  status: "sent" | "failed";
}

export interface EventHistory {
  runLog: RunLogEntry[];
  notificationLog: NotificationLogEntry[];
}

export interface TestRunResult {
  result: { triggered: boolean; payload: unknown };
  runLog: RunLogEntry;
}

export interface EventInput {
  name: string;
  type: EventType;
  config: unknown;
  isActive?: boolean;
  recipientEmail: string;
}

class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues?: unknown,
  ) {
    super(message);
  }
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

export function listEvents(): Promise<{ events: Event[] }> {
  return request("/api/events");
}

export function getEvent(id: string): Promise<{ event: Event }> {
  return request(`/api/events/${id}`);
}

export function createEvent(input: EventInput): Promise<{ event: Event }> {
  return request("/api/events", { method: "POST", body: JSON.stringify(input) });
}

export function updateEvent(id: string, input: Partial<EventInput>): Promise<{ event: Event }> {
  return request(`/api/events/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteEvent(id: string): Promise<{ success: true }> {
  return request(`/api/events/${id}`, { method: "DELETE" });
}

export function getEventHistory(id: string, limit = 20): Promise<EventHistory> {
  return request(`/api/events/${id}/history?limit=${limit}`);
}

export function testRunEvent(id: string): Promise<TestRunResult> {
  return request(`/api/events/${id}/test-run`, { method: "POST" });
}

export function getEventTypes(): Promise<{ types: EventType[] }> {
  return request("/api/event-types");
}

export { ApiClientError };
