import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  {
    ignores: [
      'dist/**',
      '.astro/**',
      '.tools/**',
      '.superpowers/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['**/*.{ts,mjs,astro}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        window: 'readonly',
        document: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    files: ['src/**/*.ts'],
    ignores: [
      'src/lib/config/build.ts',
      'src/lib/supabase/build.ts',
      'src/lib/content/snapshot.ts',
      'src/lib/content/home-build.ts',
      'src/lib/media/build-assets.ts',
      'src/lib/media/validation-build.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                'sharp',
                '**/media/build-assets*',
                '**/media/validation-build*',
                '**/config/build',
                '**/config/build.ts',
                '**/supabase/build',
                '**/supabase/build.ts',
                '**/content/snapshot',
                '**/content/snapshot.ts',
                '**/content/home-build',
                '**/content/home-build.ts',
              ],
              allowTypeImports: true,
              message: 'Build-only modules must not enter browser code.',
            },
          ],
        },
      ],
    },
  },
];
