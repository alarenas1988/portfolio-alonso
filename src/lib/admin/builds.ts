import type { AdminClient } from './repository.ts';
import { databaseError } from './errors.ts';
export const buildLabels = {
  queued: 'En cola',
  building: 'Construyendo',
  success: 'Correcto',
  failed: 'Fallido',
} as const;
export async function loadBuilds(client: AdminClient) {
  const result = await client
    .from('site_builds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (result.error) throw databaseError(result.error);
  return result.data;
}
/** F11 is not configured; saving public data never implies a static deployment. */
export async function requestPublication(
  client: AdminClient,
  requestId = crypto.randomUUID(),
): Promise<'pending' | 'queued'> {
  try {
    const session = await client.auth.getSession();
    if (!session.data.session) return 'pending';
    const { data, error } = await client.functions.invoke('publish-site', {
      body: { request_id: requestId, trigger_type: 'manual' },
      headers: { Authorization: 'Bearer ' + session.data.session.access_token },
    });
    if (error) return 'pending';
    return data && typeof data === 'object' && data.status === 'queued' ? 'queued' : 'pending';
  } catch {
    return 'pending';
  }
}
