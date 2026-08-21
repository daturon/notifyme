import { NextRequest, NextResponse } from "next/server";
import { insertRunLog, listActiveEvents, type EventRow } from "@/lib/events/repository";
import { notifyIfNeeded, type NotifyOutcome } from "@/lib/notifications/engine";
import { getProvider } from "@/lib/triggers/registry";

// Один общий cron вместо job'а на событие (раздел 7 ТЗ, "Расширяемость") —
// сам итерирует по всем активным событиям, поэтому не упирается в лимит
// invocations/cron job'ов на Hobby при росте числа событий.
export const dynamic = "force-dynamic";
// Провайдеры (парсинг курсов, запрос погоды) суммарно по всем событиям могут
// не уложиться в дефолтные 10с Hobby-плана (раздел 7 ТЗ) — расширяем лимит.
export const maxDuration = 60;

interface EventRunResult {
  eventId: string;
  eventName: string;
  triggered: boolean;
  notification: NotifyOutcome["status"];
}

interface EventRunError {
  eventId: string;
  eventName: string;
  error: string;
}

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

async function processEvent(event: EventRow): Promise<EventRunResult> {
  const provider = getProvider(event.type);
  if (!provider) {
    throw new Error(`No provider registered for event type: ${event.type}`);
  }

  const checkResult = await provider.check(event.config, { eventId: event.id });

  await insertRunLog({
    eventId: event.id,
    triggered: checkResult.triggered,
    rawResult: checkResult.payload,
  });

  const notifyOutcome = await notifyIfNeeded(event, checkResult);

  return {
    eventId: event.id,
    eventName: event.name,
    triggered: checkResult.triggered,
    notification: notifyOutcome.status,
  };
}

// Вызывается Vercel Cron раз в сутки (раздел 3 ТЗ). Каждое событие
// обрабатывается независимо в своём try/catch — падение одного провайдера
// (сеть, парсинг и т.д.) не должно прерывать обработку остальных.
async function runCron(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await listActiveEvents();

  const results: EventRunResult[] = [];
  const errors: EventRunError[] = [];

  for (const event of events) {
    try {
      results.push(await processEvent(event));
    } catch (error) {
      console.error(`cron: failed to process event ${event.id}`, error);
      errors.push({
        eventId: event.id,
        eventName: event.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const triggeredCount = results.filter((r) => r.triggered).length;
  const sentCount = results.filter((r) => r.notification === "sent").length;

  return NextResponse.json({
    checked: events.length,
    triggered: triggeredCount,
    sent: sentCount,
    results,
    errors,
  });
}

export async function GET(request: NextRequest) {
  return runCron(request);
}

export async function POST(request: NextRequest) {
  return runCron(request);
}
