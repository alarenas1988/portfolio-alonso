import { endpoint, json, type SafeLog } from '../_shared/http.ts';
import { object, string, email, uuid } from '../_shared/validation.ts';
import { invalid } from '../_shared/errors.ts';
import { daily, hmac } from '../_shared/crypto.ts';
import { clientSignal } from '../_shared/privacy.ts';
import { accepted } from '../_shared/repository.ts';
import type { EdgeConfig } from '../_shared/env.ts';
import type { Runtime } from '../_shared/runtime.ts';
import { deadline } from '../_shared/timeout.ts';
export function contactSubmit(
  getConfig: () => EdgeConfig,
  runtime: Runtime,
  log?: (entry: SafeLog) => void,
) {
  return endpoint(
    'contact-submit',
    getConfig,
    async (request, text, config) => {
      const { db } = await runtime.authorize(request, 'publishable');
      const body = object(json(text), ['name', 'email', 'subject', 'message', 'honeypot']);
      const honeypot = string(body.honeypot ?? '', 0, 500);
      if (honeypot) return { data: { status: 'accepted' } };
      const draft = {
        name: string(body.name, 2, 120),
        email: email(body.email),
        subject: string(body.subject, 3, 200),
        message: string(body.message, 20, 5000, true),
      };
      const submission = uuid(request.headers.get('idempotency-key'));
      const started = Number(request.headers.get('x-form-started-at'));
      const elapsed = runtime.now() - started;
      if (!Number.isSafeInteger(started) || elapsed < 3000 || elapsed > 86400000) invalid();
      const now = runtime.now();
      const result = accepted(
        await db.contact({
          p_submission_id: submission,
          p_name: draft.name,
          p_email: draft.email,
          p_subject: draft.subject,
          p_message: draft.message,
          p_origin_hash: await hmac(
            config.contactSecret,
            daily(now, 'contact-origin', clientSignal(request)),
          ),
          p_global_hash: await hmac(config.contactSecret, daily(now, 'contact-global', 'site')),
          p_session_hash: await hmac(
            config.analyticsSecret,
            daily(now, 'contact-conversion', submission),
          ),
          p_global_limit: config.contactGlobalLimit,
          p_notify: !!runtime.notify,
        }),
      );
      if (result.created && runtime.notify) {
        let notification: 'sent' | 'failed' = 'failed';
        try {
          await deadline((signal) => runtime.notify!(draft, signal), 5000);
          notification = 'sent';
        } catch {
          /* Persisted message is authoritative. */
        }
        try {
          await db.notification(submission, notification);
        } catch {
          /* Pending status remains available for administrative recovery. */
        }
      }
      return { data: { status: 'accepted' } };
    },
    log,
  );
}
