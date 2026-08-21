import type { EventRow } from "@/lib/events/repository";
import type { ExchangeRatePayload } from "@/lib/triggers/exchangeRate";

export interface EmailContent {
  subject: string;
  html: string;
}

// Форма payload'а провайдера weather_task (раздел 4.3 ТЗ): несколько
// "созревших" одновременно работ объединяются в одно письмо, а не рассылаются
// по одной. Провайдер weather_task ещё не реализован — тип описывает
// ожидаемый контракт payload'а заранее.
export interface WeatherTaskRecommendation {
  taskId?: string;
  title: string;
  reason: string;
}

export interface WeatherTaskPayload {
  recommendations: WeatherTaskRecommendation[];
}

function isWeatherTaskPayload(payload: unknown): payload is WeatherTaskPayload {
  return (
    !!payload &&
    typeof payload === "object" &&
    Array.isArray((payload as WeatherTaskPayload).recommendations)
  );
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function wrapHtml(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, sans-serif; color: #18181b; line-height: 1.5;">
    <h2 style="margin-bottom: 8px;">${escapeHtml(title)}</h2>
    ${bodyHtml}
    <p style="margin-top: 24px; font-size: 12px; color: #71717a;">NotifyMe</p>
  </body>
</html>`;
}

function buildExchangeRateEmail(event: EventRow, payload: ExchangeRatePayload): EmailContent {
  const subject = `NotifyMe: выгодный курс — ${event.name}`;
  const details = payload.today
    ? `<ul>
        <li>Пункт: ${escapeHtml(payload.today.sourceLabel)}</li>
        <li>Курс: ${payload.today.rate} BYN за 100 RUB</li>
        <li>Город: ${escapeHtml(payload.city)}</li>
        <li>Дата: ${escapeHtml(payload.today.recordedAt)}</li>
      </ul>`
    : "";

  return {
    subject,
    html: wrapHtml(subject, `<p>${escapeHtml(payload.message)}</p>${details}`),
  };
}

function buildWeatherTaskEmail(event: EventRow, payload: unknown): EmailContent {
  const subject = `NotifyMe: рекомендации по работам — ${event.name}`;

  if (!isWeatherTaskPayload(payload) || payload.recommendations.length === 0) {
    return {
      subject,
      html: wrapHtml(
        subject,
        "<p>Есть рекомендованные работы, но не удалось прочитать данные провайдера.</p>",
      ),
    };
  }

  const items = payload.recommendations
    .map((rec) => `<li><strong>${escapeHtml(rec.title)}</strong> — ${escapeHtml(rec.reason)}</li>`)
    .join("");

  return {
    subject,
    html: wrapHtml(subject, `<p>Рекомендуем в ближайшие дни:</p><ul>${items}</ul>`),
  };
}

function buildGenericEmail(event: EventRow, payload: unknown): EmailContent {
  const subject = `NotifyMe: событие сработало — ${event.name}`;
  return {
    subject,
    html: wrapHtml(
      subject,
      `<pre style="white-space: pre-wrap; background: #f4f4f5; padding: 8px; border-radius: 6px;">${escapeHtml(
        JSON.stringify(payload, null, 2),
      )}</pre>`,
    ),
  };
}

// Диспетчер шаблонов по типу события (раздел 4.4 п.2 ТЗ) — новый тип
// триггера добавляет свой case здесь, без изменений в notifyIfNeeded.
export function buildEventEmail(event: EventRow, payload: unknown): EmailContent {
  switch (event.type) {
    case "exchange_rate":
      return buildExchangeRateEmail(event, payload as ExchangeRatePayload);
    case "weather_task":
      return buildWeatherTaskEmail(event, payload);
    default:
      return buildGenericEmail(event, payload);
  }
}

// Тестовый режим (раздел 4.4 п.3 ТЗ) — не завязан на реальный payload
// провайдера, просто подтверждает, что Resend настроен верно.
export function buildTestEmail(event: EventRow): EmailContent {
  const subject = `NotifyMe: тестовое письмо — ${event.name}`;
  return {
    subject,
    html: wrapHtml(
      subject,
      `<p>Это тестовое письмо для события «${escapeHtml(event.name)}» (тип: ${escapeHtml(
        event.type,
      )}). Если вы его получили — Resend настроен верно.</p>`,
    ),
  };
}
