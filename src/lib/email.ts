import "server-only";

import { Resend } from "resend";

/**
 * Email transport: Resend when RESEND_API_KEY is set, otherwise a loud
 * console transport so dev flows are fully observable without a key.
 * resend.dev sender works on the free tier without domain setup.
 */
const FROM = process.env.EMAIL_FROM ?? "chatapp <onboarding@resend.dev>";

let client: Resend | null = null;
function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const r = resend();
  if (!r) {
    console.log(
      `[email:console] to=${opts.to}\nsubject: ${opts.subject}\n${opts.text}\n---`,
    );
    return;
  }
  const { error } = await r.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

/** Fire-and-forget wrapper: email must never break a money path. */
export function sendEmailSafe(opts: {
  to: string;
  subject: string;
  text: string;
}): void {
  sendEmail(opts).catch((e) => {
    console.error(`[email] send failed to=${opts.to}:`, e);
  });
}
