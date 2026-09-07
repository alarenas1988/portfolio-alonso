import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

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

test('Publishing: lost response retries same request, double click is bounded and terminal stops polling', async ({
  page,
}) => {
  const id = randomUUID(),
    requests: string[] = [];
  let stage = 'queued',
    polls = 0,
    received = false;
  const created = new Date().toISOString();
  const row = () => ({
    id,
    request_id: id,
    trigger_type: 'manual',
    status: stage,
    created_at: created,
    updated_at: created,
    started_at: stage !== 'queued' ? created : null,
    completed_at: stage === 'success' ? created : null,
    commit_sha: null,
    github_run_url: null,
    failure_reason: null,
  });
  await page.route('**/rest/v1/site_builds?*', async (route) => {
    const one = new URL(route.request().url()).searchParams.has('id');
    if (one) polls++;
    await route.fulfill({ json: one ? row() : received ? [row()] : [] });
  });
  await page.route('**/functions/v1/publish-site', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': 'http://localhost:4321',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
        },
      });
      return;
    }
    const body: { request_id: string; trigger_type: string } = route.request().postDataJSON();
    requests.push(body.request_id);
    expect(body.trigger_type).toBe('manual');
    if (requests.length === 1) {
      await route.abort('failed');
      return;
    }
    received = true;
    await route.fulfill({
      json: { build_id: id, status: 'queued' },
      headers: { 'access-control-allow-origin': 'http://localhost:4321' },
    });
  });
  await page.goto('admin/builds/');
  const submit = page.getByRole('button', { name: 'Solicitar publicación', exact: true });
  await submit.click();
  await expect(page.getByRole('status')).toContainText('No se pudo confirmar');
  await submit.evaluate((element) => {
    if (element instanceof HTMLButtonElement) {
      element.click();
      element.click();
    }
  });
  await expect(page.getByRole('status')).toHaveText('Publicación en cola');
  expect(requests).toHaveLength(2);
  expect(requests[0]).toBe(requests[1]);
  stage = 'building';
  await expect(page.getByRole('status')).toHaveText('Construyendo sitio', { timeout: 10000 });
  stage = 'success';
  await expect(page.getByRole('status')).toHaveText('Sitio actualizado', { timeout: 10000 });
  const ended = polls;
  await page.waitForTimeout(5500);
  expect(polls).toBe(ended);
  await expect(page.getByRole('link', { name: 'Ver sitio', exact: true })).toBeVisible();
  mkdirSync('.tools/f11/screenshots', { recursive: true });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `.tools/f11/screenshots/publishing-${width}.png`,
      fullPage: true,
    });
  }
});

test('Publishing: failure is actionable and leaving the module stops active polling', async ({
  page,
}) => {
  const id = randomUUID();
  let stage = 'failed',
    polls = 0;
  const row = () => ({
    id,
    request_id: id,
    trigger_type: 'manual',
    status: stage,
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    failure_reason: stage === 'failed' ? 'build_failed' : null,
  });
  await page.route('**/rest/v1/site_builds?*', async (route) => {
    const one = new URL(route.request().url()).searchParams.has('id');
    if (one) polls++;
    await route.fulfill({ json: one ? row() : [row()] });
  });
  await page.goto('admin/builds/');
  await expect(page.getByRole('heading', { name: 'Publicación fallida' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar publicación' })).toBeVisible();
  stage = 'building';
  await page.reload();
  await expect(page.getByRole('status')).toHaveText('Construyendo sitio');
  await page.goto('admin/settings/');
  const departed = polls;
  await page.waitForTimeout(5500);
  expect(polls).toBe(departed);
});

test('Publishing: edited content gets a new request while identical retries keep their identity', async ({
  page,
}) => {
  const fixture = JSON.parse(readFileSync('.tools/admin-local-state.json', 'utf8')) as {
    project: string;
  };
  const requests: string[] = [];
  await page.route('**/functions/v1/publish-site', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': 'http://localhost:4321',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
        },
      });
      return;
    }
    requests.push(route.request().postDataJSON().request_id);
    await route.abort('failed');
  });
  await page.goto('admin/projects/edit/?id=' + fixture.project);
  const publish = async () => {
    await page.getByRole('button', { name: 'Publicar contenido', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Publicar contenido', exact: true })
      .click();
    await expect(page.locator('[data-save-state]')).toHaveText('Guardado');
    await expect(page.getByRole('status', { name: 'Estado de publicación' })).toContainText(
      'No se pudo confirmar',
    );
  };
  await publish();
  await publish();
  expect(requests).toHaveLength(2);
  expect(requests[0]).toBe(requests[1]);
  await page.getByLabel('Subtítulo', { exact: true }).fill('F11 nueva revisión temporal');
  await publish();
  expect(requests).toHaveLength(3);
  expect(requests[2]).not.toBe(requests[1]);
});
