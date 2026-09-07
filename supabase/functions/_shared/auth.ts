import { createSupabaseContext } from '@supabase/server';
import type { Database } from '../../../src/types/database.ts';
import { EdgeError } from './errors.ts';
import { repository, type EdgeRepository } from './repository.ts';
import { publishingRepository, type PublishingRepository } from './publishing-repository.ts';
export type AuthMode = 'publishable' | 'user' | 'none';
export interface Authorized {
  db: EdgeRepository;
  ownerId?: string;
  publishing?: PublishingRepository;
}
export async function authorize(request: Request, mode: AuthMode): Promise<Authorized> {
  const { data: ctx, error } = await createSupabaseContext<Database>(request, {
    auth: mode,
    cors: 'disabled',
    supabaseOptions: {
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: AbortSignal.any([
              AbortSignal.timeout(8000),
              ...(init?.signal ? [init.signal] : []),
            ]),
            redirect: 'error',
          }),
      },
    },
  });
  if (error || !ctx)
    throw new EdgeError(
      error && error.status >= 500 ? 503 : 401,
      error && error.status >= 500 ? 'not_configured' : 'unauthorized',
    );
  let ownerId: string | undefined;
  if (mode === 'user') {
    // SDK validates JWT; Auth confirms the user and RLS checks the live owner profile.
    const { data: userData, error: userError } = await ctx.supabase.auth.getUser();
    if (userError || !userData.user || userData.user.id !== ctx.userClaims?.id)
      throw new EdgeError(401, 'unauthorized');
    const { data: profile, error: profileError } = await ctx.supabase
      .from('admin_profiles')
      .select('id,role,active')
      .eq('id', userData.user.id)
      .abortSignal(AbortSignal.timeout(8000))
      .maybeSingle();
    if (profileError) throw new EdgeError(503, 'temporary_failure');
    if (!profile?.active || profile.role !== 'owner') throw new EdgeError(403, 'forbidden');
    ownerId = profile.id;
  }
  // Privileged client is scoped to fixed service-only RPCs, never browser-supplied SQL/table names.
  return {
    db: repository(ctx.supabaseAdmin),
    publishing: publishingRepository(ctx.supabaseAdmin),
    ...(ownerId ? { ownerId } : {}),
  };
}
