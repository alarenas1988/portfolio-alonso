import { EdgeError, invalid } from './errors.ts';
import { uuidPattern } from './validation.ts';
import type { EdgeConfig } from './env.ts';
export type FunctionName = 'contact-submit' | 'track-event' | 'publish-site' | 'build-status';
export type SafeLog = {
  request_id: string;
  function: FunctionName;
  status: number;
  duration_ms: number;
  error_code?: string;
};
const limits: Record<FunctionName, number> = {
  'contact-submit': 16384,
  'track-event': 4096,
  'publish-site': 8192,
  'build-status': 8192,
};
const allowedHeaders = [
  'apikey',
  'authorization',
  'content-type',
  'idempotency-key',
  'x-client-info',
  'x-request-id',
  'x-form-started-at',
];
export async function bodyText(request: Request, limit: number): Promise<string> {
  const contentType = request.headers.get('content-type') || '';
  if (
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType) ||
    !['identity', ''].includes(request.headers.get('content-encoding') || '')
  )
    invalid();
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > limit))
    throw new EdgeError(413, 'too_large');
  const reader = request.body?.getReader();
  if (!reader) invalid();
  let size = 0;
  const chunks: Uint8Array[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void reader.cancel().catch(() => {});
      reject(new EdgeError(408, 'invalid_request'));
    }, 5000);
  });
  try {
    while (true) {
      const result = await Promise.race([reader.read(), timeout]);
      if (result.done) break;
      size += result.value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        throw new EdgeError(413, 'too_large');
      }
      chunks.push(result.value);
    }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(data);
    } catch {
      invalid();
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
export function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    invalid();
  }
}
export function endpoint(
  name: FunctionName,
  getConfig: () => EdgeConfig,
  handler: (
    request: Request,
    body: string,
    settings: EdgeConfig,
  ) => Promise<{ status?: number; data: Record<string, unknown> }>,
  log: (entry: SafeLog) => void = (entry) => console.log(JSON.stringify(entry)),
) {
  return async (request: Request): Promise<Response> => {
    const start = performance.now();
    const incoming = request.headers.get('x-request-id') || '';
    const requestId = uuidPattern.test(incoming) ? incoming : crypto.randomUUID();
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Request-Id': requestId,
      Vary: 'Origin',
    });
    let status = 500;
    let errorCode: string | undefined;
    try {
      const settings = getConfig();
      const origin = request.headers.get('origin');
      if (name === 'build-status') {
        if (origin) throw new EdgeError(403, 'forbidden');
      } else {
        if (!origin || !settings.origins.includes(origin)) throw new EdgeError(403, 'forbidden');
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Expose-Headers', 'X-Request-Id, Retry-After');
      }
      if (request.method === 'OPTIONS' && name !== 'build-status') {
        if (request.headers.get('access-control-request-method') !== 'POST')
          throw new EdgeError(405, 'invalid_request');
        if (
          (request.headers.get('access-control-request-headers') || '')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
            .some((h) => !allowedHeaders.includes(h))
        )
          invalid();
        headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '));
        headers.set('Access-Control-Max-Age', '600');
        status = 204;
        return new Response(null, { status, headers });
      }
      if (request.method !== 'POST') {
        headers.set('Allow', 'POST, OPTIONS');
        throw new EdgeError(405, 'invalid_request');
      }
      const text = await bodyText(request, limits[name]);
      const result = await handler(request, text, settings);
      status = result.status || 200;
      return Response.json({ ...result.data, request_id: requestId }, { status, headers });
    } catch (error) {
      const safe = error instanceof EdgeError ? error : new EdgeError(500, 'temporary_failure');
      status = safe.status;
      errorCode = safe.code;
      if (safe.retryAfter) headers.set('Retry-After', String(safe.retryAfter));
      return Response.json(
        { error: { code: safe.code, message: safe.message }, request_id: requestId },
        { status, headers },
      );
    } finally {
      log({
        request_id: requestId,
        function: name,
        status,
        duration_ms: Math.round(performance.now() - start),
        ...(errorCode ? { error_code: errorCode } : {}),
      });
    }
  };
}
