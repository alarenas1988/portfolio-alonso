import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { getBuildConfig } from './src/lib/config/build.ts';

const config = getBuildConfig(process.env.NODE_ENV === 'production' ? 'production' : 'development');

export default defineConfig({
  output: 'static',
  integrations:
    process.env.MEDIA_TEST_FIXTURE === '1'
      ? [
          {
            name: 'isolated-media-test-fixture',
            hooks: {
              'astro:config:setup': ({ injectRoute }) =>
                injectRoute({
                  pattern: '/__fixtures/media',
                  entrypoint: './tests/fixtures/media-page.astro',
                }),
            },
          },
        ]
      : [],
  site: config.origin,
  base: config.base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  vite: { plugins: [tailwindcss()] },
  devToolbar: { enabled: false },
});
