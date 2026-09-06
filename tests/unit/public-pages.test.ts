import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createPublicModel, homeFromPublic } from '../../src/lib/content/home.ts';
import {
  publicPaths,
  nextProject,
  relatedPosts,
  projectFilters,
  blogCategories,
  pageSeo,
} from '../../src/lib/content/pages.ts';
import { validateContact } from '../../src/lib/contact/validation.ts';
import { submitContact } from '../../src/lib/contact/adapter.ts';
import { publicPagesSnapshot } from '../fixtures/public-pages-snapshot.ts';
import { emptyHomeSnapshot, fixtureAssetMap, ids, fixtureId } from '../fixtures/home-snapshot.ts';
const site = 'https://example.com/portfolio-alonso/';
const model = () => createPublicModel(publicPagesSnapshot(), fixtureAssetMap(), site);

it('static paths include all public content and exclude drafts archived and future posts', () => {
  const content = model();
  assert.equal(publicPaths(content.projects).length, 3);
  assert.equal(publicPaths(content.posts).length, 4);
  assert(
    !JSON.stringify([publicPaths(content.projects), publicPaths(content.posts)]).includes('CANARY'),
  );
  assert.equal(homeFromPublic(content).posts.length, 3);
  assert.equal(content.projects[0]?.href, '/portfolio-alonso/proyectos/fixture-automatizacion/');
});
it('static route generation rejects duplicate unsafe and encoded slugs', () => {
  for (const slug of ['../draft', 'Bad', 'con_espacio', '%2f', 'área', 'a--b'])
    assert.throws(() => publicPaths([{ row: { slug } }]));
  assert.throws(() => publicPaths([{ row: { slug: 'same' } }, { row: { slug: 'same' } }]));
});
it('minimum project remains valid with no fabricated sections or media', () => {
  const project = model().projects.at(-1)!;
  assert.equal(project.row.summary, null);
  assert.equal(project.row.problem, null);
  assert.equal(project.imageId, null);
  assert.equal(project.technologies.length, 0);
});
it('complete project retains editorial sections ordered joins and public gallery references', () => {
  const content = model(),
    project = content.projects[0]!;
  for (const field of [
    'problem',
    'objective',
    'solution',
    'architecture',
    'before_markdown',
    'after_markdown',
    'learnings',
  ] as const)
    assert(project.row[field]);
  assert.equal(
    content.snapshot.project_images.filter((image) => image.project_id === project.row.id).length,
    2,
  );
  assert.equal(project.technologies.length, 2);
});
it('next project follows editorial order wraps and excludes the current or hidden resource', () => {
  const content = model();
  assert.equal(nextProject(content, ids.project)?.row.id, fixtureId(11));
  assert.equal(nextProject(content, fixtureId(12))?.row.id, ids.project);
  assert.equal(
    nextProject({ ...content, projects: content.projects.slice(0, 1) }, ids.project),
    null,
  );
  assert.equal(nextProject(content, 'unknown'), null);
});
it('filters contain only technologies and categories attached to public resources', () => {
  assert.deepEqual(
    projectFilters(model()).map((row) => row.name),
    ['TypeScript', 'Astro', 'PostgreSQL'],
  );
  assert.deepEqual(
    blogCategories(model()).map((row) => row.name),
    ['Build Notes', 'Desarrollo'],
  );
});
it('related articles prioritize categories then tags then publication recency', () => {
  const content = model();
  assert.deepEqual(
    relatedPosts(content, content.posts[0]!).map((post) => post.row.id),
    [fixtureId(22), fixtureId(21), fixtureId(23)],
  );
});
it('empty public snapshot creates indices but no detail paths filters or CV', () => {
  const content = createPublicModel(emptyHomeSnapshot(), { version: 1, assets: {} }, site);
  assert.deepEqual(publicPaths(content.posts), []);
  assert.deepEqual(publicPaths(content.projects), []);
  assert.deepEqual(projectFilters(content), []);
  assert.deepEqual(blogCategories(content), []);
  assert.equal(content.contact.cv, null);
});
it('page metadata preserves the base once and respects safe editorial overrides', () => {
  const content = model(),
    post = content.posts[0]!;
  const seo = pageSeo(content, post.href, post.row.title, 'Description', post.row);
  assert.equal(seo.canonical, `${site}blog/fixture-procesos/`);
  assert.match(seo.title, /Alonso Larenas$/);
  assert.equal(
    pageSeo(content, '/blog/', 'Blog', '', { ...post.row, canonical_url: 'javascript:alert(1)' })
      .canonical,
    `${site}blog/`,
  );
  assert.equal(
    pageSeo(content, '/blog/', 'Blog', '', {
      ...post.row,
      canonical_url: 'https://example.org/article/',
    }).canonical,
    'https://example.org/article/',
  );
  assert.equal(
    pageSeo(
      { ...content, settings: { ...content.settings, canonical_base: 'https://example.org/' } },
      post.href,
      'Article',
      '',
      post.row,
    ).canonical,
    'https://example.org/blog/fixture-procesos/',
  );
  assert.match(seo.image!, /\/assets\/media\/[0-9]{64}\.png$/);
});
const draft = {
  name: 'Test Person',
  email: 'test@example.test',
  subject: 'Una idea de prueba',
  message: 'Un mensaje sintético con contexto suficiente.',
  website: '',
};
it('contact validates required fields lengths email injection and honeypot', () => {
  assert.deepEqual(validateContact(draft), {});
  for (const field of ['name', 'email', 'subject', 'message'] as const)
    assert(validateContact({ ...draft, [field]: '' })[field]);
  assert(validateContact({ ...draft, email: 'bad@example.test\r\nBcc:other@example.test' }).email);
  assert(validateContact({ ...draft, name: 'a'.repeat(101), message: 'x'.repeat(5001) }).message);
  assert(validateContact({ ...draft, website: 'bot' }).website);
});
it('contact adapter never claims delivery and preserves the draft without networking', async () => {
  const before = { ...draft };
  assert.equal((await submitContact(draft)).status, 'unavailable');
  assert.deepEqual(draft, before);
});
