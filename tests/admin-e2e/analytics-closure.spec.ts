import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { localSql } from '../../scripts/edge-local.mjs';
import { analyticsRange, reportingToday } from '../../src/lib/analytics/queries.ts';

test.beforeEach(async ({ page }) => {
  const fixture = JSON.parse(readFileSync('.tools/admin-local-state.json', 'utf8')) as {
    actors: { owner: { email: string; password: string } };
  };
  await page.goto('admin/login/');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(fixture.actors.owner.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(fixture.actors.owner.password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.locator('[data-admin-module]')).toBeVisible();
});

for (const oldFails of [false, true])
  test(`Analytics closure: slow older ${oldFails ? 'error' : 'range'} cannot overwrite the current report`, async ({
    page,
  }) => {
    await page.goto('admin/analytics/');
    await expect(page.getByRole('heading', { name: 'Vistas por día' })).toBeVisible();
    let releaseOld = () => {};
    let signalOld = () => {};
    const oldStarted = new Promise<void>((resolve) => {
      signalOld = resolve;
    });
    const oldGate = new Promise<void>((resolve) => {
      releaseOld = resolve;
    });
    let received = 0;
    await page.route('**/rest/v1/rpc/get_analytics_report', async (route) => {
      const ordinal = ++received;
      const response = await route.fetch();
      const data: Record<string, unknown> = await response.json();
      if (!data.summary || typeof data.summary !== 'object')
        throw new Error('Missing report summary');
      data.summary = { ...data.summary, page_views: ordinal === 1 ? 707 : 3030 };
      if (ordinal === 1) {
        signalOld();
        await oldGate;
        if (oldFails) {
          await route.fulfill({ status: 503, json: { code: 'unavailable' } });
          return;
        }
      }
      await route.fulfill({ response, json: data });
    });
    await page.getByLabel('Período', { exact: true }).selectOption('7');
    await oldStarted;
    await page.getByLabel('Período', { exact: true }).selectOption('30');
    const firstStat = page.locator('.cms-stat strong').first();
    await expect(firstStat).toHaveText('3.030');
    const oldResponse = page.waitForResponse(
      async (r) =>
        r.url().endsWith('/rpc/get_analytics_report') &&
        (oldFails ? r.status() === 503 : (await r.text()).includes('707')),
    );
    releaseOld();
    await oldResponse;
    // Flush response handling and rendering without a timing-dependent sleep.
    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    );
    await expect(firstStat).toHaveText('3.030');
    await expect(page.getByLabel('Período', { exact: true })).toHaveValue('30');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

test('Analytics closure: real aggregates, zero, bounded custom, no raw downloads and expired session', async ({
  page,
}) => {
  const today = reportingToday(),
    older = analyticsRange(30).from;
  const ids = Array.from({ length: 4 }, () => randomUUID());
  localSql(`insert into public.analytics_events(event_id,session_hash,event_type,pathname,created_at) values
    ('${ids[0]}',repeat('8',64),'page_view','/portfolio-alonso/',('${older}'::date+time '12:00') at time zone 'America/Santiago'),
    ('${ids[1]}',repeat('8',64),'page_view','/portfolio-alonso/',now()),
    ('${ids[2]}',repeat('8',64),'contact_submit','/portfolio-alonso/contacto/',now()),
    ('${ids[3]}',repeat('8',64),'cv_download','/portfolio-alonso/',now());
    set role service_role;select public.refresh_analytics('${older}','${older}');select public.refresh_analytics();reset role;`);
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/')) requests.push(new URL(request.url()).pathname);
  });
  try {
    await page.goto('admin/analytics/');
    const values = page.locator('.cms-stat strong');
    await expect(values).toHaveText(['2', '1', '1', '1']);
    await expect(page.getByText('Sesiones aproximadas', { exact: true })).toBeVisible();
    await page.getByLabel('Período', { exact: true }).selectOption('7');
    await expect(values).toHaveText(['1', '1', '1', '1']);
    await page.getByLabel('Desde', { exact: true }).fill(older);
    await page.getByLabel('Hasta', { exact: true }).fill(older);
    await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
    await expect(values).toHaveText(['1', '1', '0', '0']);
    const empty = analyticsRange(90).from;
    await page.getByLabel('Desde', { exact: true }).fill(empty);
    await page.getByLabel('Hasta', { exact: true }).fill(empty);
    await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
    await expect(values).toHaveText(['0', '0', '0', '0']);
    await expect(page.getByText('Todavía no hay eventos en este período.')).toBeVisible();
    expect(requests.some((path) => path.endsWith('/analytics_events'))).toBe(false);
    expect(requests.filter((path) => path.endsWith('/get_analytics_report'))).toHaveLength(4);
    await page.getByLabel('Desde', { exact: true }).fill('2020-01-01');
    await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('máximo 366');
    await expect(values).toHaveCount(0);
    await page.route('**/auth/v1/user', (r) =>
      r.fulfill({ status: 401, json: { code: 'session_not_found', message: 'Session missing' } }),
    );
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.locator('[data-admin-module]')).toBeHidden();
    await page.unroute('**/auth/v1/user');
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect(page.locator('[data-admin-module]')).toBeVisible();
  } finally {
    localSql(
      `delete from public.analytics_events where event_id in (${ids.map((id) => "'" + id + "'").join(',')});set role service_role;select public.refresh_analytics('${older}','${older}');select public.refresh_analytics('${today}','${today}');reset role;`,
    );
  }
});
