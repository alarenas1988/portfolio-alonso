import { buildStatus } from './handler.ts';
import { config } from '../_shared/env.ts';
import { runtime } from '../_shared/runtime.ts';
Deno.serve(buildStatus(() => config((key) => Deno.env.get(key)), runtime));
