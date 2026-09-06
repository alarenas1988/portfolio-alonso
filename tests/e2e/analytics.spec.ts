import { test, expect, type Page } from '@playwright/test';
async function enable(page: Page, privacy: 'none' | 'dnt' | 'gpc' = 'none') {
  await page.addInitScript(
    ({ privacy }) => {
      if (location.hostname !== '127.0.0.1') throw new Error('Analytics tests only allow loopback');
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      if (privacy === 'dnt') Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });
      if (privacy === 'gpc')
        Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
      const observer = new MutationObserver(() => {
        if (!document.body) return;
        Object.assign(document.body.dataset, {
          analyticsEnabled: 'true',
          analyticsEndpoint: location.origin + '/functions/v1/track-event',
          analyticsKey: 'sb_publishable_analytics_fixture',
          analyticsSite: location.origin + '/portfolio-alonso/',
        });
        observer.disconnect();
      });
      observer.observe(document, { childList: true, subtree: true });
    },
    { privacy },
  );
}
async function capture(page: Page, status = 200) {
  const events: Record<string, unknown>[] = [];
  await page.route('**/functions/v1/track-event', async (route) => {
    expect(route.request().headers().authorization).toBeUndefined();
    expect(route.request().headers().cookie).toBeUndefined();
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    events.push(payload);
    for (const key of [
      'name',
      'email',
      'message',
      'subject',
      'ip',
      'Authorization',
      'access_token',
      'cookie',
    ])
      expect(payload[key]).toBeUndefined();
    await route.fulfill({ status, contentType: 'application/json', body: '{"status":"accepted"}' });
  });
  return events;
}
test.beforeEach(({ baseURL }, info) =>
  test.skip(
    !baseURL?.startsWith('http://127.0.0.1:4322/') ||
      (info.project.name !== 'mobile-390' && info.project.name !== 'desktop-1440'),
    'Analytics behavior exercised at mobile and desktop; visual matrix remains in existing tests.',
  ),
);
for (const [route, type] of [
  ['', 'page_view'],
  ['proyectos/fixture-automatizacion/', 'project_view'],
  ['blog/fixture-procesos/', 'post_view'],
] as const)
  test('analytics actual navigation ' + (route || 'Home'), async ({ page }) => {
    await enable(page);
    const events = await capture(page);
    await page.goto(route + '?token=DO_NOT_SEND#private');
    await expect.poll(() => events.filter((e) => e.event_type === type).length).toBe(1);
    expect(events.filter((e) => e.event_type === 'page_view')).toHaveLength(1);
    expect(JSON.stringify(events)).not.toMatch(/DO_NOT_SEND|#private|token=/);
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      document.dispatchEvent(new Event('astro:page-load'));
    });
    await page.waitForTimeout(100);
    expect(events.filter((e) => e.event_type === type)).toHaveLength(1);
    const previous = events[0]!.session_id;
    await page.reload();
    await expect.poll(() => events.filter((e) => e.event_type === type).length).toBe(2);
    expect(events.at(-1)!.session_id).toBe(previous);
  });
test('delegated meaningful actions and confirmed copy; no double firing', async ({ page }) => {
  await enable(page);
  const events = await capture(page);
  await page.goto('');
  await expect.poll(() => events.length).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.resolve() },
      configurable: true,
    });
    document.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a[href]'))
        event.preventDefault();
    });
  });
  for (const [selector, type] of [
    ['a[href^="https://wa.me/"]', 'whatsapp_click'],
    ['a[href^="mailto:"]', 'email_click'],
    ['a[href^="https://github.com/"]', 'github_click'],
    ['a[href^="https://www.linkedin.com/"],a[href^="https://linkedin.com/"]', 'linkedin_click'],
    ['a[data-interaction="cv_download"]', 'cv_download'],
  ] as const) {
    await page.locator(selector).first().click();
    await expect.poll(() => events.filter((e) => e.event_type === type).length).toBe(1);
  }
  await page.locator('[data-copy-email]').first().click();
  await expect.poll(() => events.filter((e) => e.event_type === 'email_copy').length).toBe(1);
  expect(events.some((e) => e.event_type === 'contact_submit')).toBe(false);
});
test('demo and article share use published context without titles or channel blobs', async ({
  page,
}) => {
  await enable(page);
  const events = await capture(page);
  await page.goto('proyectos/fixture-automatizacion/');
  await page.evaluate(() =>
    document.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a[target="_blank"]'))
        event.preventDefault();
    }),
  );
  await page.locator('[data-analytics-event="demo_click"]').click();
  await expect.poll(() => events.filter((e) => e.event_type === 'demo_click').length).toBe(1);
  expect(events.find((e) => e.event_type === 'demo_click')!.project_id).toMatch(/^[a-f0-9-]{36}$/);
  await page.goto('blog/fixture-procesos/');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.resolve() },
      configurable: true,
    });
    document.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a[target="_blank"]'))
        event.preventDefault();
    });
  });
  await page.locator('[data-share-linkedin]').click();
  await expect.poll(() => events.filter((e) => e.event_type === 'article_share').length).toBe(1);
  await page.locator('[data-copy-link]').click();
  await expect.poll(() => events.filter((e) => e.event_type === 'article_share').length).toBe(2);
  expect(
    events
      .filter((e) => e.event_type === 'article_share')
      .every((e) => !!e.post_id && !('title' in e)),
  ).toBe(true);
});
test('analytics network failure never blocks real internal navigation', async ({ page }) => {
  await enable(page);
  const events = await capture(page, 503);
  await page.goto('');
  await page
    .locator('footer a')
    .filter({ hasText: /^Blog$/ })
    .click();
  await expect(page).toHaveURL(/\/blog\/$/);
  await expect(page.locator('h1')).toContainText('Ideas');
  await expect.poll(() => events.filter((e) => e.event_type === 'page_view').length).toBe(2);
});
for (const signal of ['dnt', 'gpc'] as const)
  test('explicit privacy opt-out ' + signal, async ({ page }) => {
    await enable(page, signal);
    const events = await capture(page);
    await page.goto('');
    await page.waitForTimeout(150);
    expect(events).toHaveLength(0);
    expect(await page.evaluate(() => sessionStorage.getItem('al.analytics.session'))).toBeNull();
  });
test('general test artifact has analytics disabled, including no-JS', async ({ page, browser }) => {
  const events = await capture(page);
  await page.goto('');
  await expect(page.locator('body')).toHaveAttribute('data-analytics-enabled', 'false');
  expect(events).toHaveLength(0);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const plain = await context.newPage();
  const requests: string[] = [];
  plain.on('request', (r) => {
    if (r.url().includes('/functions/v1/track-event')) requests.push(r.url());
  });
  await plain.goto('http://127.0.0.1:4322/portfolio-alonso/');
  await plain
    .locator('footer a')
    .filter({ hasText: /^Blog$/ })
    .click();
  await expect(plain).toHaveURL(/\/blog\/$/);
  expect(requests).toHaveLength(0);
  await context.close();
});
