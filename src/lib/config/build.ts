import { loadEnv } from 'vite';
import { readPublicConfig } from './public.ts';

/** Node/build-only module. No backend secrets are needed for a public SSG build. */
export function getBuildConfig(mode: string) {
  return readPublicConfig(loadEnv(mode, process.cwd(), 'PUBLIC_'));
}
