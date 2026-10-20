// Sends login codes: through Resend (plain fetch, no SDK) when RESEND_API_KEY is set,
// else to the console. With MAIL_LOG set, the console mailer also appends
// "<email> <code>" lines to that file (the e2e tests read codes from it).
import { appendFileSync } from 'node:fs';

const RESEND_URL = 'https://api.resend.com/emails';

/** createMailer(env, log, fetch) -> { send(to, code) }. Throws in production without a key. */
export function createMailer(env, log = console.log, fetchFn = globalThis.fetch) {
  if (env.RESEND_API_KEY) {
    if (!env.MAIL_FROM) throw new Error('MAIL_FROM is required when RESEND_API_KEY is set.');
    return {
      async send(to, code) {
        const res = await fetchFn(RESEND_URL, {
          method: 'POST',
          headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            from: env.MAIL_FROM,
            to: [to],
            subject: `Your DEUS deck sign-in code: ${code}`,
            text: `Your sign-in code is ${code}. It expires in 10 minutes.\n\n`
              + "If you didn't ask for it, you can ignore this email.",
          }),
        });
        if (!res.ok) throw new Error(`Resend refused the email (${res.status}): ${await res.text?.()}`);
      },
    };
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('RESEND_API_KEY is not set: production cannot send login codes.');
  }
  return {
    async send(to, code) {
      log(`Login code for ${to}: ${code}`);
      if (env.MAIL_LOG) appendFileSync(env.MAIL_LOG, `${to} ${code}\n`);
    },
  };
}
