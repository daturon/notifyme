import { hasSentNotificationToday, insertNotificationLog, type EventRow } from "@/lib/events/repository";
import type { TriggerCheckResult } from "@/lib/triggers/types";
import { sendEmail } from "./resend";
import { buildEventEmail, buildTestEmail } from "./templates";

export type NotifyOutcome =
  | { status: "not_triggered" }
  | { status: "already_sent_today" }
  | { status: "sent" }
  | { status: "failed"; error: string };

// Notification Engine (раздел 4.4 ТЗ), общий для всех типов триггеров:
// - не более 1 письма в сутки на событие (проверка по notification_log);
// - при ошибке отправки — один retry, затем лог "failed";
// - никогда не бросает исключение наружу, чтобы сбой одного события не
//   останавливал обработку остальных в общем cron-запуске (раздел 3).
export async function notifyIfNeeded(
  event: EventRow,
  checkResult: TriggerCheckResult,
): Promise<NotifyOutcome> {
  if (!checkResult.triggered) {
    return { status: "not_triggered" };
  }

  try {
    if (await hasSentNotificationToday(event.id)) {
      return { status: "already_sent_today" };
    }
  } catch (error) {
    console.error(`notifyIfNeeded: failed to check notification_log for event ${event.id}`, error);
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }

  const email = buildEventEmail(event, checkResult.payload);

  let sent = false;
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= 2 && !sent; attempt += 1) {
    try {
      await sendEmail({ to: event.recipientEmail, subject: email.subject, html: email.html });
      sent = true;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`notifyIfNeeded: send attempt ${attempt} failed for event ${event.id}`, error);
    }
  }

  try {
    await insertNotificationLog({
      eventId: event.id,
      subject: email.subject,
      body: email.html,
      status: sent ? "sent" : "failed",
    });
  } catch (logError) {
    console.error(`notifyIfNeeded: failed to write notification_log for event ${event.id}`, logError);
  }

  return sent ? { status: "sent" } : { status: "failed", error: lastError ?? "unknown error" };
}

// Тестовый режим (раздел 4.4 п.3 ТЗ): отправляет письмо на recipient_email
// события напрямую, минуя проверку триггера и дедупликацию по
// notification_log — только чтобы подтвердить, что Resend настроен верно.
// Ошибка отправки здесь намеренно всплывает наружу — вызывающий роут должен
// сообщить пользователю, что именно не сработало.
export async function sendTestEmail(event: EventRow): Promise<void> {
  const email = buildTestEmail(event);
  await sendEmail({ to: event.recipientEmail, subject: email.subject, html: email.html });
}
