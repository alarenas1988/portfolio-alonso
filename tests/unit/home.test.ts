import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createHomeModel } from '../../src/lib/content/home.ts';
import {
  emailActions,
  excerptText,
  formatEditorialDate,
  formatPeriod,
  safeExternalUrl,
  whatsappUrl,
} from '../../src/lib/content/presentation.ts';
import {
  emptyHomeSnapshot,
  fullHomeSnapshot,
  fixtureAssetMap,
  fixtureId,
  ids,
} from '../fixtures/home-snapshot.ts';
const site = 'https://example.com/portfolio-alonso/';

it('maps the public snapshot into sorted Home sections and relations', () => {
  const model = createHomeModel(fullHomeSnapshot(), fixtureAssetMap(), site);
  assert.equal(model.projects.length, 3);
  assert.equal(model.posts.length, 3);
  assert.equal(model.projects[0]?.technologies[0]?.name, 'TypeScript');
  assert.equal(model.projects[0]?.impact?.value, 'Un flujo');
  assert.equal(model.experiences[0]?.projects[0]?.row.id, ids.project);
  assert.deepEqual(
    model.stack.map((group) => group.category),
    ['Desarrollo', 'Datos', 'Automatización', 'Herramientas'],
  );
});
it('empty collections do not invent projects technologies experience metrics or contact channels', () => {
  const model = createHomeModel(emptyHomeSnapshot(), { version: 1, assets: {} }, site);
  for (const rows of [model.projects, model.posts, model.stack, model.experiences, model.metrics])
    assert.equal(rows.length, 0);
  assert.equal(model.contact.email, null);
  assert.equal(model.contact.whatsapp, null);
  assert.equal(model.contact.cv, null);
  assert.equal(model.socialLinks.length, 0);
});
it('requires real settings and a configured Hero title instead of publishing an empty Home', () => {
  assert.throws(
    () =>
      createHomeModel({ ...emptyHomeSnapshot(), settings: null }, { version: 1, assets: {} }, site),
    /requires/,
  );
});
it('keeps draft archived future and unfeatured projects out of featured cards', () => {
  const source = fullHomeSnapshot();
  const project = source.projects[0]!;
  for (const changes of [
    { published: false },
    { status: 'archived' },
    { published_at: '2099-01-01T12:00:00Z' },
    { featured: false },
  ]) {
    const model = createHomeModel(
      { ...source, projects: [{ ...project, ...changes }] },
      fixtureAssetMap(),
      site,
    );
    assert.equal(model.projects.length, 0);
  }
});
it('filters hidden technologies and their joins, experiences specialties principles and metrics', () => {
  const source = fullHomeSnapshot();
  const model = createHomeModel(
    {
      ...source,
      technologies: source.technologies.map((row) => ({ ...row, visible: false })),
      experiences: source.experiences.map((row) => ({ ...row, visible: false })),
      specialties: source.specialties.map((row) => ({ ...row, visible: false })),
      principles: source.principles.map((row) => ({ ...row, visible: false })),
      impact_metrics: source.impact_metrics.map((row) => ({ ...row, visible: false })),
    },
    fixtureAssetMap(),
    site,
  );
  assert.equal(model.projects[0]?.technologies.length, 0);
  for (const rows of [
    model.stack,
    model.experiences,
    model.specialties,
    model.principles,
    model.metrics,
  ])
    assert.equal(rows.length, 0);
});
it('limits recent public posts to three and hides drafts future posts and hidden taxonomy', () => {
  const source = fullHomeSnapshot();
  const post = source.posts[0]!;
  const model = createHomeModel(
    {
      ...source,
      categories: source.categories.map((row) => ({ ...row, visible: false })),
      posts: [
        ...source.posts,
        { ...post, id: fixtureId(201), status: 'draft' },
        { ...post, id: fixtureId(202), published_at: '2099-01-01T12:00:00Z' },
        { ...post, id: fixtureId(203), published_at: '2020-01-01T12:00:00Z' },
      ],
    },
    fixtureAssetMap(),
    site,
  );
  assert.equal(model.posts.length, 3);
  assert.equal(model.posts[0]?.row.id, ids.post);
  assert.equal(model.posts[0]?.categories.length, 0);
});
it('resolves only built public images and refuses broken references', () => {
  assert.throws(
    () => createHomeModel(fullHomeSnapshot(), { version: 1, assets: {} }, site),
    /image is unavailable/,
  );
  const source = fullHomeSnapshot();
  assert.throws(() =>
    createHomeModel(
      {
        ...source,
        media_assets: source.media_assets.map((row) => ({ ...row, visibility: 'private' })),
      },
      fixtureAssetMap(),
      site,
    ),
  );
});
it('creates base-aware Home anchors for subpath and root installations', () => {
  assert.equal(
    createHomeModel(emptyHomeSnapshot(), { version: 1, assets: {} }, site).links.about,
    '/portfolio-alonso/#sobre-mi',
  );
  assert.equal(
    createHomeModel(emptyHomeSnapshot(), { version: 1, assets: {} }, 'https://example.com/').links
      .projects,
    '/#proyectos',
  );
});
it('honors contact visibility even if a fixture contains hidden channel values', () => {
  const source = fullHomeSnapshot();
  const model = createHomeModel(
    {
      ...source,
      contact: {
        ...source.contact!,
        email_visible: false,
        whatsapp_visible: false,
        cv_enabled: false,
      },
      social_links: source.social_links.map((row) => ({ ...row, visible: false })),
    },
    fixtureAssetMap(),
    site,
  );
  assert.equal(model.contact.email, null);
  assert.equal(model.contact.whatsapp, null);
  assert.equal(model.contact.cv, null);
  assert.equal(model.socialLinks.length, 0);
});
it('offers CV only when enabled active public PDF and present in the F8 map', () => {
  const source = fullHomeSnapshot();
  const assets = fixtureAssetMap();
  assert.ok(createHomeModel(source, assets, site).contact.cv?.href.endsWith('.pdf'));
  assert.equal(
    createHomeModel(
      { ...source, documents: source.documents.map((row) => ({ ...row, active: false })) },
      assets,
      site,
    ).contact.cv,
    null,
  );
  assert.equal(
    createHomeModel(
      { ...source, media_assets: source.media_assets.filter((row) => row.id !== ids.pdf) },
      assets,
      site,
    ).contact.cv,
    null,
  );
  const missing = { ...assets, assets: { ...assets.assets } };
  delete missing.assets[ids.pdf];
  assert.throws(() => createHomeModel(source, missing, site), /CV is missing/);
});
it('ignores legacy remote CV URLs instead of bypassing the local artifact', () => {
  const source = emptyHomeSnapshot();
  assert.equal(
    createHomeModel(
      {
        ...source,
        settings: { ...source.settings!, cv_url: 'https://example.com/private.pdf?token=secret' },
        contact: { ...source.contact!, cv_enabled: true },
      },
      { version: 1, assets: {} },
      site,
    ).contact.cv,
    null,
  );
});
it('encodes WhatsApp international numbers and messages without a hardcoded destination', () => {
  const href = whatsappUrl('+56 (9) 1234-5678', 'Hola & gracias / IA');
  assert.ok(href);
  const url = new URL(href);
  assert.equal(url.pathname, '/56912345678');
  assert.equal(url.searchParams.get('text'), 'Hola & gracias / IA');
  for (const value of ['123', '012345678', 'javascript:alert(1)', '1234567890123456'])
    assert.equal(whatsappUrl(value), null);
});
it('builds safe email actions and rejects header injection', () => {
  assert.equal(
    emailActions(' nombre+portfolio@example.test ')?.email,
    'nombre+portfolio@example.test',
  );
  for (const value of [
    'bad',
    'a@example.test\r\nBcc:other@example.test',
    'a@example.test?subject=bad',
  ])
    assert.equal(emailActions(value), null);
});
it('rejects dangerous external URLs and credential-bearing links', () => {
  assert.equal(safeExternalUrl('https://example.com/path'), 'https://example.com/path');
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,test',
    '//example.com',
    'http://example.com',
    'https://user:password@example.com/',
    'https://example.com\\bad',
  ])
    assert.equal(safeExternalUrl(value), null);
});
it('formats editorial dates in Santiago and periods without shifting calendar dates', () => {
  assert.match(formatEditorialDate('2026-01-01T01:00:00Z', 'America/Santiago'), /31.*2025/);
  assert.match(formatPeriod('2024-01-01', null, true)!, /ene.*2024.*Actualidad/);
  assert.equal(formatPeriod(null, null, false), null);
  assert.throws(() => formatPeriod('2024-02-31', null, false));
});
it('derives metadata from public settings and canonical configuration', () => {
  const source = fullHomeSnapshot();
  const model = createHomeModel(
    {
      ...source,
      settings: { ...source.settings!, canonical_base: 'https://portfolio.example.test/' },
    },
    fixtureAssetMap(),
    site,
  );
  assert.equal(model.seo.title, 'AL — Home de prueba');
  assert.equal(model.seo.canonical, 'https://portfolio.example.test/');
  assert.equal(model.seo.robots, 'index,follow');
});
it('uses plain text excerpts without rendering HTML or a full article', () => {
  assert.equal(
    excerptText('**Primero** [comprender](https://example.com).\n\nDespués construir.'),
    'Primero comprender. Después construir.',
  );
  assert.equal(
    excerptText('![Privado](media:00000000-0000-0000-0000-000000000001) Texto'),
    'Texto',
  );
});
