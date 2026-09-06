import type { ContactDraft } from './validation.ts';
export type ContactState =
  'idle' | 'validating' | 'submitting' | 'success' | 'error' | 'rate-limited';
export type ContactResult = {
  status: 'success' | 'error' | 'rate-limited' | 'unavailable';
  message: string;
  requestId?: string;
  retryAfter?: number;
};
export interface ContactTransport {
  url: string;
  publishableKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}
export interface ContactAttempt {
  idempotencyKey: string;
  startedAt: number;
}
const failure: ContactResult = {
  status: 'error',
  message: 'No pudimos confirmar la recepción. Conservamos tu mensaje; puedes volver a intentarlo.',
};

/** Public key is an apikey, never a user JWT. The server owns all authorization. */
export async function submitContact(
  draft: ContactDraft,
  transport?: ContactTransport,
  attempt?: ContactAttempt,
): Promise<ContactResult> {
  if (!transport || !attempt)
    return {
      status: 'unavailable',
      message: 'El formulario no está disponible. Utiliza los canales de contacto publicados.',
    };
  let url: URL;
  try {
    url = new URL(transport.url);
  } catch {
    return failure;
  }
  if (
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^sb_publishable_[\w-]+$/.test(transport.publishableKey)
  )
    return failure;
  url.pathname = '/functions/v1/contact-submit';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), transport.timeoutMs ?? 15000);
  try {
    const response = await (transport.fetch ?? fetch)(url, {
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        apikey: transport.publishableKey,
        'Idempotency-Key': attempt.idempotencyKey,
        'X-Form-Started-At': String(attempt.startedAt),
      },
      body: JSON.stringify({
        name: draft.name,
        email: draft.email,
        subject: draft.subject,
        message: draft.message,
        honeypot: draft.website,
      }),
    });
    const requestId = response.headers.get('x-request-id');
    const support = requestId && /^[0-9a-f-]{36}$/i.test(requestId) ? { requestId } : {};
    if (response.status === 429)
      return {
        status: 'rate-limited',
        message: 'Hemos recibido varios intentos. Espera unos minutos antes de volver a enviar.',
        retryAfter: Math.min(3600, Math.max(1, Number(response.headers.get('retry-after')) || 900)),
        ...support,
      };
    if (!response.ok) return { ...failure, ...support };
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('status' in body) || body.status !== 'accepted')
      return { ...failure, ...support };
    return {
      status: 'success',
      message: 'Mensaje recibido. Gracias por contarme tu idea.',
      ...support,
    };
  } catch {
    return failure;
  } finally {
    clearTimeout(timeout);
  }
}

/** One in-flight request; unchanged retries reuse the UUID after a lost response. No persistent PII. */
export function contactSession(
  transport: ContactTransport,
  now: () => number = Date.now,
  nextId: () => string = () => crypto.randomUUID(),
) {
  let startedAt = now();
  let previous = '';
  let idempotencyKey = '';
  let active: Promise<ContactResult> | null = null;
  return {
    send(draft: ContactDraft): Promise<ContactResult> {
      if (active) return active;
      const fingerprint = JSON.stringify(draft);
      if (fingerprint !== previous) {
        previous = fingerprint;
        idempotencyKey = nextId();
      }
      active = submitContact(draft, transport, { idempotencyKey, startedAt })
        .then((result) => {
          if (result.status === 'success') {
            previous = '';
            idempotencyKey = '';
            startedAt = now();
          }
          return result;
        })
        .finally(() => {
          active = null;
        });
      return active;
    },
  };
}
