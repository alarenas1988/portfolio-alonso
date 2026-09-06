import { authorize, type Authorized, type AuthMode } from './auth.ts';
import { dispatch } from './github.ts';
import type { EdgeConfig } from './env.ts';
export interface ContactText {
  name: string;
  email: string;
  subject: string;
  message: string;
}
export interface Runtime {
  authorize: (request: Request, mode: AuthMode) => Promise<Authorized>;
  dispatch: (config: EdgeConfig, buildId: string) => Promise<void>;
  now: () => number;
  notify?: (message: ContactText, signal: AbortSignal) => Promise<void>;
}
export const runtime: Runtime = { authorize, dispatch, now: () => Date.now() };
