import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, mkdirSync, unlinkSync, existsSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database.ts';
import { supabaseFetch } from '../../src/lib/supabase/transport.ts';
import { localStatus } from '../../scripts/edge-local.mjs';
const stateFile = '.tools/admin-owner-browser.json';
type Fixture = {
  actors: Record<'owner' | 'normal' | 'inactive', { email: string; password: string; id: string }>;
  project: string;
  post: string;
  tech: string;
  message: string;
  assets: { id: string }[];
};
const fixture = () => JSON.parse(readFileSync('.tools/admin-local-state.json', 'utf8')) as Fixture;
async function login(page: Page, kind: 'owner' | 'normal' | 'inactive' = 'owner') {
  await page.goto('admin/login/');
  const actor = fixture().actors[kind];
  await page.getByLabel('Correo electrónico', { exact: true }).fill(actor.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(actor.password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
}
async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('[data-admin-module]')).toBeVisible();
}
test.beforeAll(async ({ browser }) => {
  mkdirSync('.tools/admin-screenshots', { recursive: true });
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } }),
    page = await context.newPage();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('http://localhost:4321/portfolio-alonso/admin/login/');
    await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
    await page.screenshot({
      path: '.tools/admin-screenshots/login-' + width + '.png',
      fullPage: true,
    });
  }
  await page.goto('http://localhost:4321/portfolio-alonso/admin/login/');
  const actor = fixture().actors.owner;
  await page.getByLabel('Correo electrónico', { exact: true }).fill(actor.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(actor.password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.locator('[data-admin-module]')).toBeVisible();
  await context.storageState({ path: stateFile });
  await context.close();
});
test.afterAll(() => {
  if (existsSync(stateFile)) unlinkSync(stateFile);
});
// Every test gets its own Auth session. Logging out must revoke that session,
// including any browser contexts deliberately sharing it.
test.use({ storageState: { cookies: [], origins: [] } });
test.beforeEach(async ({ page }) => {
  await login(page);
  await expect(page.locator('[data-admin-module]')).toBeVisible();
});
test('Auth: anonymous deep link, invalid login, noowner and inactive owner', async ({
  browser,
}) => {
  for (const kind of ['normal', 'inactive'] as const) {
    const context = await browser.newContext({
        baseURL: 'http://localhost:4321/portfolio-alonso/',
        storageState: { cookies: [], origins: [] },
      }),
      page = await context.newPage();
    await page.goto('admin/projects/edit/?id=' + fixture().project);
    await expect(page).toHaveURL(/admin\/login\//);
    await login(page, kind);
    await expect(page.getByRole('alert')).toContainText('No se pudo iniciar sesión');
    await expect(page.locator('[data-admin-module]')).toHaveCount(0);
    await context.close();
  }
  const context = await browser.newContext({
      baseURL: 'http://localhost:4321/portfolio-alonso/',
      storageState: { cookies: [], origins: [] },
    }),
    page = await context.newPage();
  await page.goto('admin/login/');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('invalid@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('invalid-password');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await context.close();
});
test('Owner: private dashboard and direct editor link survive reload', async ({ page }) => {
  await ready(page, 'admin/');
  await expect(page.getByRole('heading', { name: 'Contenido editorial' })).toBeVisible();
  await ready(page, 'admin/projects/edit/?id=' + fixture().project);
  await expect(page.getByLabel('Título', { exact: true }).first()).toHaveValue(
    'Automatización de procesos · fixture',
  );
  await page.reload();
  await expect(page.getByLabel('Título', { exact: true }).first()).toHaveValue(
    'Automatización de procesos · fixture',
  );
  await page.goto('admin/projects/edit/?id=invalid');
  await expect(page.locator('[data-admin-module]')).toContainText('identificador no es válido');
});
test('Project: create, autosave, relations, concurrency, publication and delete', async ({
  page,
  browser,
}) => {
  await ready(page, 'admin/projects/new/');
  await page.getByLabel('Título', { exact: true }).fill('F7 E2E proyecto');
  await page.getByLabel('Slug', { exact: true }).fill('f7-e2e-project');
  await page.getByLabel('Resumen ejecutivo').fill('Contenido temporal para comprobar el editor.');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[data-save-state]')).toHaveText('Guardado');
  await expect(page).toHaveURL(/edit\/\?id=/);
  const url = page.url();
  await page.getByRole('tab', { name: 'Relaciones', exact: true }).click();
  await page.getByRole('button', { name: 'Añadir funcionalidades', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).last().fill('Funcionalidad local');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[data-save-state]')).toHaveText('Guardado');
  const other = await browser.newContext({ storageState: stateFile }),
    otherPage = await other.newPage();
  await otherPage.goto(url);
  await expect(otherPage.getByLabel('Título', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  await page.getByLabel('Subtítulo', { exact: true }).fill('Primera pestaña');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[data-save-state]')).toHaveText('Guardado');
  await otherPage.getByLabel('Subtítulo', { exact: true }).fill('Conflicto');
  await otherPage.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(otherPage.locator('[data-save-state]')).toHaveText('Conflicto de revisión', {
    timeout: 20000,
  });
  await other.close();
  await page.getByRole('button', { name: 'Publicar contenido', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Publicar contenido', exact: true })
    .click();
  await expect(page.getByRole('status', { name: 'Estado de publicación' })).toContainText(
    'No se pudo confirmar',
  );
  await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page).toHaveURL(/admin\/projects\/$/);
});
test('Blog: Markdown sanitizer, TOC, code and real taxonomy relations', async ({ page }) => {
  await ready(page, 'admin/posts/edit/?id=' + fixture().post);
  await page.getByRole('tab', { name: 'Contenido', exact: true }).click();
  const editor = page.getByLabel('Artículo en Markdown');
  await editor.fill(
    '## Uno\nTexto **fuerte**\n## Dos\n<script>window.CMS_XSS=true</script>\n[x](javascript:alert(1))\n## Tres\n```javascript\nconst ok = true;\n```',
  );
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
  await expect(page.locator('.cms-preview h2')).toHaveCount(3);
  await expect(page.locator('.cms-preview script')).toHaveCount(0);
  await expect(page.locator('.cms-preview a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.locator('.cms-preview code')).toContainText('const ok');
  await expect(
    page.getByRole('navigation', { name: 'Contenido de la vista previa' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[data-save-state]')).toHaveText('Guardado');
  await page.getByRole('tab', { name: 'Relaciones', exact: true }).click();
  await page.getByText('Buscar y añadir relaciones', { exact: true }).first().click();
  await page.getByRole('button', { name: /Añadir Automatización/ }).click();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[data-save-state]')).toHaveText('Guardado');
});
test('Media: private upload, alt, publication, uses and protected deletion', async ({ page }) => {
  await ready(page, 'admin/media/');
  await expect(page.getByText(/archivos en la biblioteca/)).toBeVisible();
  await page.locator('.media-card').filter({ hasText: 'Público' }).first().click();
  await page.getByRole('button', { name: 'Consultar usos', exact: true }).click();
  await expect(page.locator('[data-status]')).toContainText('Usado en:');
  await page.getByRole('button', { name: 'Eliminar archivo', exact: true }).click();
  await expect(page.locator('[data-status]')).toContainText('No se puede eliminar');
  await page.getByRole('button', { name: 'Nuevo archivo', exact: true }).click();
  await page.getByLabel('Archivo', { exact: true }).setInputFiles({
    name: 'f7-e2e-image.png',
    mimeType: 'image/png',
    buffer: await sharp({ create: { width: 8, height: 8, channels: 4, background: '#22d3ee' } })
      .png()
      .toBuffer(),
  });
  await page.getByLabel('Texto alternativo', { exact: true }).fill('Imagen local de prueba');
  await page.getByRole('button', { name: 'Guardar archivo o metadata' }).click();
  await expect(page.locator('[data-status]')).toContainText('Archivo privado guardado');
  await page.getByRole('button', { name: 'Publicar copia', exact: true }).click();
  await expect(page.locator('[data-status]')).toContainText('Copia pública creada');
  await page.getByRole('button', { name: 'Eliminar archivo', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Eliminar archivo', exact: true })
    .click();
  await expect(page.locator('[data-status]')).toContainText('Archivo eliminado');
});
test('Messages: unsafe HTML remains text and state changes persist', async ({ page }) => {
  await ready(page, 'admin/messages/');
  await page.getByRole('button', { name: 'Leer mensaje' }).first().click();
  await expect(page.locator('.cms-message-body')).toContainText('<script>');
  await expect(page.locator('.cms-message-body script')).toHaveCount(0);
  await page.getByRole('button', { name: 'Marcar leído' }).click();
  await expect(page.locator('.cms-notice').first()).toContainText('Estado actualizado');
  await page.getByRole('button', { name: 'Marcar respondido' }).click();
  await expect(page.locator('.cms-notice').first()).toContainText('Estado actualizado');
});
test('Analytics: private aggregates, periods, bounded invalid range, network error', async ({
  page,
}) => {
  await ready(page, 'admin/analytics/');
  await expect(page.getByRole('heading', { name: 'Vistas por día' })).toBeVisible();
  await page.getByLabel('Período', { exact: true }).selectOption('7');
  await expect(page.locator('.cms-notice').first()).toContainText('America/Santiago');
  await page.getByLabel('Desde', { exact: true }).fill('2020-01-01');
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('máximo 366');
  await page.route('**/rest/v1/rpc/get_analytics_report', (r) => r.abort());
  await page.getByLabel('Período', { exact: true }).selectOption('30');
  await expect(page.getByRole('alert')).toContainText('No se pudo obtener');
});
test('Settings: invalid URL blocked, save and reload persist', async ({ page }) => {
  await ready(page, 'admin/contact/');
  const title = page.getByLabel('Título de contacto', { exact: true });
  const original = await title.inputValue();
  await title.fill('F7 E2E contacto');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[data-save-state]')).toHaveText('Guardado');
  await page.reload();
  await expect(title).toHaveValue('F7 E2E contacto');
  await title.fill(original);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[data-save-state]')).toHaveText('Guardado');
  await ready(page, 'admin/seo/');
  await page.getByLabel('Base canonical', { exact: true }).fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[aria-invalid=true]')).toHaveCount(1);
});
test('Auth: recovery invalid token and logout clear private UI', async ({ page }) => {
  await login(page);
  await ready(page, 'admin/');
  await page.getByRole('button', { name: 'Salir ↗' }).click();
  await expect(page).toHaveURL(/admin\/login\//);
  await page.goto('admin/messages/');
  await expect(page).toHaveURL(/admin\/login\//);
  await page.goto('admin/reset-password/?code=invalid');
  await expect(page.getByRole('alert')).toContainText('enlace no es válido');
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeVisible();
});
test('Responsive visual evidence and keyboard accessibility for all principal modules', async ({
  page,
}) => {
  const routes = [
    ['dashboard', 'admin/'],
    ['projects', 'admin/projects/'],
    ['project-editor', 'admin/projects/edit/?id=' + fixture().project],
    ['blog', 'admin/posts/'],
    ['post-editor', 'admin/posts/edit/?id=' + fixture().post],
    ['media', 'admin/media/'],
    ['messages', 'admin/messages/'],
    ['analytics', 'admin/analytics/'],
    ['settings', 'admin/settings/'],
  ];
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [label, path] of routes) {
      await ready(page, path!);
      await expect(page.locator('[data-admin-module]')).not.toBeEmpty();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: '.tools/admin-screenshots/' + label + '-' + width + '.png',
        fullPage: true,
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        a11y.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page, 'admin/');
  await page.getByRole('button', { name: 'Menú', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Panel administrativo' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Menú', exact: true })).toBeFocused();
  for (const width of [360, 1024, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [, path] of routes) {
      await ready(page, path!);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  }
});
test('Direct REST: noowner cannot save or read messages despite forged metadata', async () => {
  const local = localStatus(),
    client = createClient<Database>(local.API_URL, local.PUBLISHABLE_KEY, {
      global: { fetch: supabaseFetch },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  await client.auth.signInWithPassword(fixture().actors.normal);
  await client.auth.updateUser({ data: { role: 'owner', active: true } });
  const result = await client.rpc('save_project', {
    p_id: fixture().project,
    p_expected: null!,
    p_record: { title: 'Unauthorized' },
  });
  expect(result.error?.code).toBe('42501');
  const messages = await client.from('contact_messages').select('*');
  expect(messages.data).toEqual([]);
  await client.auth.signOut();
});

test('Editorial modules: create, edit, order and delete real local records', async ({ page }) => {
  const cases = [
    {
      route: 'technologies',
      create: 'Crear tecnología',
      fields: { Nombre: 'F7 E2E tecnología', Slug: 'f7-e2e-tech', Categoría: 'Desarrollo' },
    },
    {
      route: 'specialties',
      create: 'Crear especialidad',
      fields: { Título: 'F7 E2E especialidad', Slug: 'f7-e2e-specialty' },
    },
    {
      route: 'principles',
      create: 'Crear principio',
      fields: { Título: 'F7 E2E principio', Número: '99' },
    },
    {
      route: 'impact',
      create: 'Crear métrica',
      fields: { Etiqueta: 'F7 E2E impacto', Valor: '-70%' },
    },
    {
      route: 'categories',
      create: 'Crear categoría',
      fields: { Nombre: 'F7 E2E categoría', Slug: 'f7-e2e-category' },
    },
    { route: 'tags', create: 'Crear tag', fields: { Nombre: 'F7 E2E tag', Slug: 'f7-e2e-tag' } },
    {
      route: 'social',
      create: 'Crear red social',
      fields: {
        Plataforma: 'github',
        Etiqueta: 'F7 E2E red',
        'URL HTTPS': 'https://github.com/example',
      },
    },
  ];
  for (const item of cases) {
    await ready(page, 'admin/' + item.route + '/');
    await page.getByRole('button', { name: '+ ' + item.create, exact: true }).click();
    for (const [label, value] of Object.entries(item.fields))
      await page.getByLabel(label, { exact: true }).fill(value!);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.locator('[data-save-state]')).toHaveText('Guardado');
    const order = page.getByLabel('Orden editorial', { exact: true });
    if (await order.count()) {
      await order.fill('8');
      await page.getByRole('button', { name: 'Guardar', exact: true }).click();
      await expect(page.locator('[data-save-state]')).toHaveText('Guardado');
    }
    await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(page.locator('[data-admin-module]')).toBeVisible();
  }
  await ready(page, 'admin/experience/');
  await page.getByRole('button', { name: '+ Crear experiencia', exact: true }).click();
  await page.getByLabel('Cargo', { exact: true }).fill('F7 E2E cargo');
  await page.getByLabel('Organización', { exact: true }).fill('F7 E2E local');
  await page.getByLabel('Fecha de inicio', { exact: true }).fill('2026-01-01');
  await page.getByLabel('Cargo actual', { exact: true }).check();
  await page.getByRole('tab', { name: 'Relaciones', exact: true }).click();
  await page.getByRole('button', { name: 'Añadir hitos', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('Hito sintético local');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[data-save-state]')).toHaveText('Guardado');
  await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.locator('[data-admin-module]')).toBeVisible();
});

test('MediaPicker and CV: private PDF, publish copy, activate, deactivate and remove document', async ({
  page,
}) => {
  await ready(page, 'admin/projects/edit/?id=' + fixture().project);
  await page.getByRole('button', { name: 'Seleccionar portada', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Seleccionar archivo' });
  await expect(picker.getByRole('button', { name: /cms-fixture.png.*Público/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Seleccionar portada', exact: true }),
  ).toBeFocused();
  await ready(page, 'admin/documents/');
  await page.getByLabel('Título del documento', { exact: true }).fill('F7 E2E CV');
  await page.getByRole('button', { name: 'Seleccionar / subir PDF', exact: true }).click();
  await picker.getByText('Cargar un archivo privado', { exact: true }).click();
  const pdf = await PDFDocument.create();
  pdf.addPage([100, 100]);
  await picker.getByLabel('Archivo', { exact: true }).setInputFiles({
    name: 'f7-e2e-cv.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save()),
  });
  await picker.getByRole('button', { name: 'Subir archivo', exact: true }).click();
  await expect(picker).not.toBeVisible();
  await page.getByRole('button', { name: 'Registrar documento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'F7 E2E CV', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Publicar PDF', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publicar PDF', exact: true }).click();
  await expect(page.locator('.cms-notice').first()).toContainText('Copia pública vinculada');
  await page.getByRole('button', { name: 'Activar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Desactivar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Desactivar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Activar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar registro', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Eliminar registro', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'F7 E2E CV', exact: true })).toHaveCount(0);
});

test('Session failure hides private editor and preserves unsaved text in its current tab', async ({
  page,
}) => {
  await ready(page, 'admin/projects/edit/?id=' + fixture().project);
  await page.route('**/rest/v1/rpc/save_project', (r) => r.abort());
  await page.getByLabel('Subtítulo', { exact: true }).fill('F7 E2E unsaved');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[data-save-state]')).toHaveText('Error al guardar');
  await page.route('**/auth/v1/user', (r) =>
    r.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'session_not_found', message: 'Session missing' }),
    }),
  );
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('[data-admin-module]')).toBeHidden();
  await expect(page.locator('[data-admin-gate]')).toContainText('Tus cambios se conservan');
  await page.unroute('**/auth/v1/user');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByLabel('Subtítulo', { exact: true })).toHaveValue('F7 E2E unsaved');
});

test('Recovery: real local Auth email and PKCE callback update only the local fixture password', async ({
  page,
}) => {
  await page.goto('admin/reset-password/');
  const actor = fixture().actors.owner;
  await page.getByLabel('Correo electrónico', { exact: true }).fill(actor.email);
  await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('recibirás un enlace');
  let messageId = '';
  await expect
    .poll(async () => {
      const inbox = await (await fetch('http://127.0.0.1:58424/api/v1/messages')).json();
      const message = inbox.messages.find((m: { ID: string; To: { Address: string }[] }) =>
        m.To.some((t) => t.Address === actor.email),
      );
      messageId = message?.ID ?? '';
      return Boolean(messageId);
    })
    .toBe(true);
  const mail = await (await fetch('http://127.0.0.1:58424/api/v1/message/' + messageId)).json();
  const href = String(mail.HTML)
    .match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]
    ?.replaceAll('&amp;', '&');
  if (!href || new URL(href).origin !== 'http://127.0.0.1:58421')
    throw new Error('Local recovery link missing or wrong origin');
  await page.goto(href);
  await expect(page.getByRole('heading', { name: 'Establece una nueva contraseña' })).toBeVisible();
  const password = randomBytes(32).toString('base64url') + 'Aa1!';
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Guardar nueva contraseña', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Contraseña actualizada');
  const state = JSON.parse(readFileSync('.tools/admin-local-state.json', 'utf8'));
  state.actors.owner.password = password;
  writeFileSync('.tools/admin-local-state.json', JSON.stringify(state));
  await login(page);
  await expect(page.locator('[data-admin-module]')).toBeVisible();
  await fetch('http://127.0.0.1:58424/api/v1/messages', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: [messageId] }),
  });
});
