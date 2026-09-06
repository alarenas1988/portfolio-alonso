import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createUrlHelpers } from '../../src/lib/utils/urls.ts';

describe('site URLs', () => {
  for (const [site, path, expected] of [
    ['https://example.com/', '/proyectos', '/proyectos/'],
    ['https://example.com/portfolio-alonso/', '/', '/portfolio-alonso/'],
    ['https://example.com/portfolio-alonso/', '/blog', '/portfolio-alonso/blog/'],
    ['https://example.com/portfolio-alonso/', '/portfolio-alonso/blog/', '/portfolio-alonso/blog/'],
    [
      'https://example.com/portfolio-alonso/',
      '/admin/projects/edit/?id=123',
      '/portfolio-alonso/admin/projects/edit/?id=123',
    ],
    [
      'https://example.com/portfolio-alonso/',
      '/assets/site.css',
      '/portfolio-alonso/assets/site.css',
    ],
    [
      'https://example.com/portfolio-alonso/',
      '/blog#articulos',
      '/portfolio-alonso/blog/#articulos',
    ],
    [
      'https://example.com/portfolio-alonso/',
      '/portfolio-alonso-extra',
      '/portfolio-alonso/portfolio-alonso-extra/',
    ],
  ]) {
    it(`resolves ${path} below ${site}`, () => {
      assert.equal(createUrlHelpers(site!).withBase(path!), expected);
    });
  }

  it('builds an absolute URL without duplicating the repository base', () => {
    const urls = createUrlHelpers('https://example.com/portfolio-alonso/');
    assert.equal(urls.absoluteUrl('/blog/'), 'https://example.com/portfolio-alonso/blog/');
  });

  for (const unsafe of [
    'https://evil.example/',
    '//evil.example/',
    'javascript:alert(1)',
    '../admin',
    '/x/../../admin',
    '/%2e%2e/admin',
    '/x\\admin',
  ]) {
    it(`rejects unsafe internal destination ${unsafe}`, () => {
      assert.throws(() =>
        createUrlHelpers('https://example.com/portfolio-alonso/').withBase(unsafe),
      );
    });
  }
});
