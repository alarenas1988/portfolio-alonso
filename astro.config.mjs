import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { getBuildConfig } from './src/lib/config/build.ts';
import { homeAssetsIntegration } from './scripts/home-assets-integration.mjs';

const config = getBuildConfig(process.env.NODE_ENV === 'production' ? 'production' : 'development');

export default defineConfig({
  output: 'static',
  integrations: [
    homeAssetsIntegration(),
    ...(process.env.MEDIA_TEST_FIXTURE === '1'
      ? [
          {
            name: 'isolated-media-test-fixture',
            hooks: {
              'astro:config:setup': ({ injectRoute }) => {
                injectRoute({
                  pattern: '/__fixtures/media',
                  entrypoint: './tests/fixtures/media-page.astro',
                });
                injectRoute({
                  pattern: '/__fixtures/design-system',
                  entrypoint: './tests/fixtures/design-system-page.astro',
                });
                injectRoute({
                  pattern: '/__fixtures/empty-home',
                  entrypoint: './tests/fixtures/empty-home-page.astro',
                });
              },
            },
          },
        ]
      : []),
  ],
  site: config.origin,
  base: config.base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  vite: { plugins: [tailwindcss()] },
  devToolbar: { enabled: false },
});
