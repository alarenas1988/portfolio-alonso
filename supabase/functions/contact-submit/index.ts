import { contactSubmit } from './handler.ts';
import { config } from '../_shared/env.ts';
import { runtime } from '../_shared/runtime.ts';
Deno.serve(contactSubmit(() => config((key) => Deno.env.get(key)), runtime));
