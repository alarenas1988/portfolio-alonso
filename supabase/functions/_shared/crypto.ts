import { secret } from './env.ts';
import { EdgeError } from './errors.ts';
const encoder = new TextEncoder();
async function key(value: string) {
  return await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret(value)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
export async function hmac(value: string, text: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', await key(value), encoder.encode(text)),
  );
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function daily(now: number, namespace: string, signal: string): string {
  return `${new Date(now).toISOString().slice(0, 10)}:${namespace}:${signal}`;
}
export async function verifyCallback(request: Request, body: string, value: string, now: number) {
  secret(value);
  const timestamp = request.headers.get('x-build-timestamp') || '';
  const signature = request.headers.get('x-build-signature') || '';
  if (
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    !/^v1=[a-f0-9]{64}$/.test(signature)
  )
    throw new EdgeError(401, 'unauthorized');
  const bytes = Uint8Array.from(signature.slice(3).match(/../g)!, (byte) => parseInt(byte, 16));
  // WebCrypto verifies the MAC without a JavaScript early-exit byte comparison.
  if (
    !(await crypto.subtle.verify(
      'HMAC',
      await key(value),
      bytes,
      encoder.encode(`${timestamp}.${body}`),
    ))
  )
    throw new EdgeError(401, 'unauthorized');
}
