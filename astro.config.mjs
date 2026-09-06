import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { getBuildConfig } from './src/lib/config/build.ts';

const config = getBuildConfig(process.env.NODE_ENV === 'production' ? 'production' : 'development');

export default defineConfig({
  output: 'static',
  site: config.origin,
  base: config.base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  vite: { plugins: [tailwindcss()] },
  devToolbar: { enabled: false },
});
