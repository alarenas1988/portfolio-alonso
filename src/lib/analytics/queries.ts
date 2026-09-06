import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.ts';
import { events } from '../../../supabase/functions/_shared/events.ts';
type Daily = Database['public']['Tables']['analytics_daily']['Row'];
export type AnalyticsSummary = Omit<Daily, 'date'>;
export interface AnalyticsReport {
  from: string;
  to: string;
  timezone: 'America/Santiago';
  summary: AnalyticsSummary;
  daily: Daily[];
  topPages: { pathname: string; views: number }[];
  topContent: {
    content_type: 'project' | 'post';
    content_id: string;
    views: number;
    interactions: number;
  }[];
  dimensions: {
    dimension: 'referrer_domain' | 'device_type' | 'browser_family';
    value: string;
    views: number;
  }[];
}
const metrics = [
  ...events.map((e) => (e === 'email_copy' ? 'email_copies' : e + 's')),
  'unique_sessions',
] as (keyof AnalyticsSummary)[];
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid analytics report');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid report field');
  return value;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('Invalid report count');
  return value;
}
function rows(value: unknown, limit: number): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error('Invalid report rows');
  return value.map(record);
}
function totals(value: unknown): AnalyticsSummary {
  const row = record(value);
  return Object.fromEntries(metrics.map((key) => [key, count(row[key])])) as AnalyticsSummary;
}
function day(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid analytics date');
  const parsed = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value)
    throw new Error('Invalid analytics date');
  return parsed;
}
export function reportingToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day'].map((key) => parts.find((p) => p.type === key)!.value).join('-');
}
export function analyticsRange(days: 7 | 30 | 90 | 366, now = new Date()) {
  const to = reportingToday(now);
  return { from: new Date(day(to) - (days - 1) * 86400000).toISOString().slice(0, 10), to };
}
export function validateRange(from: string, to: string, now = new Date()) {
  const start = day(from),
    end = day(to),
    today = day(reportingToday(now));
  if (end < start || end - start > 365 * 86400000 || end > today || start < today - 399 * 86400000)
    throw new Error('Analytics range must use 1–366 retained reporting dates');
  return { from, to };
}
export function parseAnalyticsReport(value: unknown): AnalyticsReport {
  const row = record(value);
  const from = text(row.from),
    to = text(row.to);
  day(from);
  day(to);
  if (row.timezone !== 'America/Santiago') throw new Error('Invalid analytics timezone');
  return {
    from,
    to,
    timezone: 'America/Santiago',
    summary: totals(row.summary),
    daily: rows(row.daily, 366).map((r) => ({ date: text(r.date), ...totals(r) })),
    topPages: rows(row.top_pages, 20).map((r) => ({
      pathname: text(r.pathname),
      views: count(r.views),
    })),
    topContent: rows(row.top_content, 40).map((r) => {
      if (r.content_type !== 'project' && r.content_type !== 'post')
        throw new Error('Invalid content dimension');
      return {
        content_type: r.content_type,
        content_id: text(r.content_id),
        views: count(r.views),
        interactions: count(r.interactions),
      };
    }),
    dimensions: rows(row.dimensions, 64).map((r) => {
      if (
        r.dimension !== 'referrer_domain' &&
        r.dimension !== 'device_type' &&
        r.dimension !== 'browser_family'
      )
        throw new Error('Invalid dimension');
      return { dimension: r.dimension, value: text(r.value), views: count(r.views) };
    }),
  };
}
/** SQL enforces owner; this repository reads aggregates only, never raw traffic. */
export async function loadAnalyticsReport(
  client: SupabaseClient<Database>,
  from: string,
  to: string,
): Promise<AnalyticsReport> {
  validateRange(from, to);
  const { data, error } = await client.rpc('get_analytics_report', { p_from: from, p_to: to });
  if (error) throw new Error('Analytics report unavailable or access denied');
  return parseAnalyticsReport(data);
}
