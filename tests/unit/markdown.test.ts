import assert from 'node:assert/strict';
import { it } from 'node:test';
import { renderMarkdown } from '../../src/lib/markdown/render.ts';
import { readingTime } from '../../src/lib/markdown/reading-time.ts';
import { headingIds } from '../../src/lib/markdown/toc.ts';
import { longArticle } from '../fixtures/public-pages-snapshot.ts';
import { fixtureAssetMap, ids } from '../fixtures/home-snapshot.ts';
const options = { assets: fixtureAssetMap(), siteUrl: 'https://example.com/portfolio-alonso/' };
it('table descendants use the same safe links and media contract as paragraphs', async () => {
  const { html } = await renderMarkdown(
    `| Link | Media |\n| --- | --- |\n| [Blog](/blog/) | ![test](media:${ids.image}) |`,
    options,
  );
  assert.match(html, /href="\/portfolio-alonso\/blog\/"/);
  assert.match(html, /<picture>/);
  assert.match(html, /scope="col"/);
  await assert.rejects(
    renderMarkdown('| Media |\n| --- |\n| ![test](https://evil.example/image.png) |', options),
  );
});

it('renders rich Markdown with local media table lists quote syntax and escaped code', async () => {
  const result = await renderMarkdown(longArticle, options);
  for (const tag of [
    '<h2',
    '<h3',
    '<strong',
    '<ol',
    '<ul',
    '<blockquote',
    '<table',
    '<picture',
    '<source',
    '<pre',
    '<code',
  ])
    assert(result.html.includes(tag), tag);
  assert.match(result.html, /process.ts/);
  assert.match(result.html, /syntax-keyword/);
  assert.match(result.html, /width="960" height="600"/);
  assert(!result.html.includes('media:'));
  assert(!result.html.includes('<script>'));
  assert(result.toc.length >= 3);
});
for (const [name, payload] of Object.entries({
  script: '<script>alert(1)</script>',
  javascript: '[click](javascript:alert%281%29)',
  iframe: '<iframe src="https://evil.example/"></iframe>',
  onerror: '<img src=x onerror=alert(1)>',
  onclick: '<a href="https://example.com" onclick="alert(1)">click</a>',
  svg: '<svg onload="alert(1)"><script>alert(2)</script></svg>',
  arbitraryHtml: '<form><input autofocus onfocus=alert(1)></form><style>body{display:none}</style>',
  obfuscated: '[click](java&#x73;cript:alert%281%29)',
  dataUrl: '[click](data:text/html,test)',
  invalid:
    '[click](https://user:password@example.com/) [click](//evil.example/) [click](https://example.com\\evil)',
}))
  it(`sanitizes adversarial Markdown: ${name}`, async () => {
    const { html } = await renderMarkdown(payload);
    assert(
      !/<(?:script|iframe|svg|form|input|style|object|embed)\b|\son\w+=|href="(?:javascript|data|\/\/)|style=/i.test(
        html,
      ),
      html,
    );
  });
it('raw HTML never provides styling or attributes on otherwise allowed elements', async () => {
  const { html } = await renderMarkdown(
    '<div style="color:red"><h2 id="location" onclick="bad()">Title</h2></div>',
  );
  assert(!/style=|onclick=|id="location"/.test(html));
});
it('TOC has stable unique clobber-safe anchors matching the final sanitized headings', async () => {
  const source = '# Título\n\n## Repetido\n\n### Repetido\n\n## Repetido-2\n\n## Repetido';
  const a = await renderMarkdown(source),
    b = await renderMarkdown(source);
  assert.deepEqual(a, b);
  assert.equal(new Set(a.toc.map((entry) => entry.id)).size, a.toc.length);
  for (const entry of a.toc) assert(a.html.includes(`id="${entry.id}"`));
  assert(!a.html.includes('<h1'));
  const id = headingIds();
  assert.equal(id('Árbol & datos'), 'article-arbol-datos-1');
});
it('short articles omit TOC and compute deterministic reading time without frontmatter', async () => {
  assert.deepEqual((await renderMarkdown('## Breve\n\nUn párrafo.')).toc, []);
  assert.equal(readingTime('palabra '.repeat(441)), 3);
  assert.equal(readingTime(`---\ntitle: ${'metadata '.repeat(1000)}\n---\nTexto`), 1);
});
it('Markdown images require a public F8 artifact and never accept arbitrary image URLs', async () => {
  for (const url of [
    'https://evil.example/a.png',
    '/assets/a.png',
    'data:image/svg+xml,test',
    `media:${ids.pdf}`,
  ])
    await assert.rejects(renderMarkdown(`![image](${url})`, options), /public media asset/);
  await assert.rejects(renderMarkdown(`![image](media:${ids.image})`), /public media asset/);
  const map = fixtureAssetMap();
  map.assets[ids.image]!.src = 'https://evil.example/image.png';
  await assert.rejects(
    renderMarkdown(`![image](media:${ids.image})`, { ...options, assets: map }),
    /local build artifacts/,
  );
});
it('code metadata is escaped unknown languages fall back safely and line numbers are optional', async () => {
  const { html } = await renderMarkdown(
    '```unknown filename="<img>" lines\n<script>literal</script>\n```',
  );
  assert(!html.includes('<script>'));
  assert(!html.includes('<img>'));
  assert.match(html, /class="numbered"/);
  assert.match(html, /&#x3C;script>|&lt;script>/);
});
it('internal links use the base once unsafe paths lose navigation and external links are isolated', async () => {
  const { html } = await renderMarkdown(
    '[Blog](/blog/) [About](/portfolio-alonso/sobre-mi/) [unsafe](/../secret) [external](https://example.org/)',
    options,
  );
  assert.match(html, /href="\/portfolio-alonso\/blog\/"/);
  assert.match(html, /href="\/portfolio-alonso\/sobre-mi\/"/);
  assert(!html.includes('href="/../'));
  assert.match(html, /rel="noopener noreferrer"/);
});
