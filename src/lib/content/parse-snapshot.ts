import type { PublicSnapshot } from '../../types/content.ts';
import { snapshotRowRules, type ColumnRule } from './snapshot-contract.ts';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function invalid(): never {
  throw new Error('Invalid public snapshot contract.');
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key)))
    invalid();
}
function fieldValid(value: unknown, rule: ColumnRule): boolean {
  if (value === null) return rule.endsWith('?');
  switch (rule.replace('?', '')) {
    case 'text':
      return typeof value === 'string';
    case 'uuid':
      return typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
    case 'integer':
      return typeof value === 'number' && Number.isSafeInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'date':
      return (
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value))
      );
    case 'instant':
      return (
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}T/.test(value) &&
        !Number.isNaN(Date.parse(value))
      );
    default:
      return false;
  }
}
function rowValid(value: unknown, rules: Readonly<Record<string, ColumnRule>>): void {
  if (!record(value)) invalid();
  exactKeys(value, Object.keys(rules));
  for (const [key, rule] of Object.entries(rules)) if (!fieldValid(value[key], rule)) invalid();
}

export function parsePublicSnapshot(value: unknown): PublicSnapshot {
  if (!record(value)) invalid();
  exactKeys(value, ['schema_version', 'generated_at', ...Object.keys(snapshotRowRules)]);
  if (value.schema_version !== 1 || !fieldValid(value.generated_at, 'instant')) invalid();
  for (const [key, rules] of Object.entries(snapshotRowRules)) {
    const rows: unknown = value[key];
    if (key === 'settings' || key === 'contact') {
      if (rows !== null) rowValid(rows, rules);
    } else {
      if (!Array.isArray(rows)) invalid();
      for (const row of rows) rowValid(row, rules);
    }
  }
  // Every nested field has been checked above, including rejection of extra/private columns.
  return value as unknown as PublicSnapshot;
}
