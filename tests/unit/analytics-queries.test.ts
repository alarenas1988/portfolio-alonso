import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyticsRange,
  reportingToday,
  validateRange,
  parseAnalyticsReport,
} from '../../src/lib/analytics/queries.ts';
import { events } from '../../supabase/functions/_shared/events.ts';
test('report date ranges follow Santiago including DST and month boundaries', () => {
  assert.equal(reportingToday(new Date('2026-09-06T03:59:59Z')), '2026-09-05');
  assert.equal(reportingToday(new Date('2026-09-06T04:00:00Z')), '2026-09-06');
  assert.deepEqual(analyticsRange(7, new Date('2026-09-06T12:00:00Z')), {
    from: '2026-08-31',
    to: '2026-09-06',
  });
  assert.deepEqual(analyticsRange(30, new Date('2026-09-06T12:00:00Z')), {
    from: '2026-08-08',
    to: '2026-09-06',
  });
});
test('custom ranges are bounded and impossible dates rejected', () => {
  const now = new Date('2026-09-06T12:00:00Z');
  for (const [from, to] of [
    ['2026-02-30', '2026-03-01'],
    ['2026-09-07', '2026-09-07'],
    ['2026-09-06', '2026-09-05'],
    ['2025-01-01', '2026-09-06'],
  ])
    assert.throws(() => validateRange(from!, to!, now));
  assert.deepEqual(validateRange('2026-09-01', '2026-09-06', now), {
    from: '2026-09-01',
    to: '2026-09-06',
  });
});
test('typed aggregate DTO excludes unknown raw/private fields and validates counters', () => {
  const summary = {
    ...Object.fromEntries(events.map((e) => [e === 'email_copy' ? 'email_copies' : e + 's', 0])),
    unique_sessions: 0,
  };
  const source = {
    from: '2026-09-06',
    to: '2026-09-06',
    timezone: 'America/Santiago',
    summary,
    daily: [],
    top_pages: [],
    top_content: [],
    dimensions: [],
    session_hash: 'must not escape',
    email: 'private@example.test',
  };
  const parsed = parseAnalyticsReport(source);
  assert(!JSON.stringify(parsed).includes('must not escape'));
  assert(!('email' in parsed));
  assert.throws(() => parseAnalyticsReport({ ...source, summary: { ...summary, page_views: -1 } }));
  assert.throws(() => parseAnalyticsReport({ ...source, timezone: 'UTC' }));
  assert.throws(() =>
    parseAnalyticsReport({ ...source, top_content: [{ content_type: 'private' }] }),
  );
});
