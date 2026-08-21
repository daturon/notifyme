import { Resend } from "resend";

// Синглтон через globalThis по тому же принципу, что и lib/db.ts — модуль
// переживает hot-reload в dev, не плодит новых клиентов на каждое изменение.
const globalForResend = globalThis as unknown as {
  resendClient: Resend | undefined;
};

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  if (!globalForResend.resendClient) {
    globalForResend.resendClient = new Resend(apiKey);
  }
  return globalForResend.resendClient;
}

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const client = getResendClient();
  const from = process.env.NOTIFICATIONS_FROM_EMAIL ?? "NotifyMe <onboarding@resend.dev>";

  const { error } = await client.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    throw new Error(error.message ?? "Resend send failed");
  }
}
