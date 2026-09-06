import { invalid } from './errors.ts';
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    invalid();
  return value as Record<string, unknown>;
}
export function string(value: unknown, min: number, max: number, multiline = false): string {
  if (typeof value !== 'string') invalid();
  const text = value.trim().normalize('NFC').replace(/\r\n?/g, '\n');
  if (
    [...text].length < min ||
    [...text].length > max ||
    [...text].some(
      (c) =>
        c.charCodeAt(0) === 127 ||
        (c.charCodeAt(0) < 32 && !(multiline && ['\n', '\t'].includes(c))),
    )
  )
    invalid();
  return text;
}
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) invalid();
  return value.toLowerCase();
}
export function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    invalid();
  return value;
}
export function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) invalid();
  return value as T;
}
export function instant(value: unknown): string {
  const text = string(value, 20, 30);
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(text) ||
    !Number.isFinite(Date.parse(text))
  )
    invalid();
  return new Date(text).toISOString();
}
export function email(value: unknown): string {
  const text = string(value, 3, 254).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(text)) invalid();
  return text;
}
