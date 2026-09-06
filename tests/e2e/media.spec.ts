import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';

test('isolated media library preserves metadata on failure, retries and blocks deletion in use', async ({
  page,
}, testInfo) => {
  await page.goto('__fixtures/media/');
  await expect(page.getByRole('heading', { name: 'Archivos y recursos' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Todavía no hay archivos.');
  const bytes = await sharp({
    create: { width: 32, height: 24, channels: 4, background: '#22d3ee' },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel('Archivo', { exact: true })
    .setInputFiles({ name: 'diseño.png', mimeType: 'image/png', buffer: bytes });
  await page.getByLabel('Texto alternativo').fill('Diagrama informativo');
  await page.getByLabel('Descripción', { exact: true }).fill('Metadata escrita antes del fallo');
  await page.getByRole('button', { name: 'Guardar archivo o metadata' }).click();
  await expect(page.getByRole('status')).toContainText('Fallo de red');
  await expect(page.getByLabel('Texto alternativo')).toHaveValue('Diagrama informativo');
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveValue(
    'Metadata escrita antes del fallo',
  );
  await page.getByRole('button', { name: 'Guardar archivo o metadata' }).click();
  await expect(page.getByRole('status')).toContainText('Archivo privado guardado');
  await expect(page.locator('[data-upload-state]')).toHaveAttribute(
    'data-upload-state',
    'complete',
  );
  await expect(page.locator('.media-card')).toHaveCount(1);
  await expect(page.locator('.media-card')).toContainText('Privado');
  await page.getByRole('button', { name: 'Eliminar archivo' }).click();
  await expect(page.getByRole('status')).toContainText('No se puede eliminar. Usado en: proyecto');
  await expect(page.locator('.media-card')).toHaveCount(1);
  await page.getByLabel('La imagen es únicamente decorativa').check();
  await expect(page.getByLabel('Texto alternativo')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .include('#fixture-media')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('media-library.png'), fullPage: true });
});
