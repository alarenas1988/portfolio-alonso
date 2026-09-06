import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readPublicConfig } from '../../src/lib/config/public.ts';

describe('public configuration boundary', () => {
  it('supports an unconfigured Supabase bootstrap without inventing credentials', () => {
    const config = readPublicConfig({ PUBLIC_SITE_URL: 'https://example.com/portfolio-alonso' });
    assert.equal(config.siteUrl, 'https://example.com/portfolio-alonso/');
    assert.equal(config.base, '/portfolio-alonso/');
    assert.equal(config.supabase, null);
  });

  it('returns only approved public fields', () => {
    const config = readPublicConfig({
      PUBLIC_SITE_URL: 'https://example.com/',
      SUPABASE_SECRET_KEY: 'private-canary',
    });
    assert.equal(JSON.stringify(config).includes('private-canary'), false);
  });

  it('accepts the publishable format without parsing it as a JWT', () => {
    const config = readPublicConfig({
      PUBLIC_SUPABASE_URL: 'https://project.example.com',
      PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_not_a_credential',
    });
    assert.equal(config.supabase?.publishableKey, 'sb_publishable_test_not_a_credential');
  });

  for (const key of ['sb_secret_not_allowed', 'eyJhbGciOiJIUzI1NiJ9.fake.jwt']) {
    it('rejects secret or legacy JWT credentials in public configuration', () => {
      assert.throws(() =>
        readPublicConfig({
          PUBLIC_SUPABASE_URL: 'https://project.example.com',
          PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
        }),
      );
    });
  }

  it('rejects half configured Supabase credentials without leaking the value', () => {
    assert.throws(
      () => readPublicConfig({ PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private_canary' }),
      (error: unknown) => error instanceof Error && !error.message.includes('private_canary'),
    );
  });

  for (const site of [
    'http://example.com/',
    'https://user:password@example.com/',
    'https://example.com/?secret=x',
    'https://example.com/#section',
    'javascript:alert(1)',
  ]) {
    it(`rejects invalid public site URL ${site}`, () =>
      assert.throws(() => readPublicConfig({ PUBLIC_SITE_URL: site })));
  }

  it('allows HTTP for the loopback development server', () => {
    assert.equal(
      readPublicConfig({ PUBLIC_SITE_URL: 'http://localhost:4321/portfolio-alonso/' }).base,
      '/portfolio-alonso/',
    );
  });
});
