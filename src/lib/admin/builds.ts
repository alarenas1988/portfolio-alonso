import type { AdminClient } from './repository.ts';
import { databaseError } from './errors.ts';
export const buildLabels = {
  queued: 'Publicación en cola',
  building: 'Construyendo sitio',
  success: 'Sitio actualizado',
  failed: 'Publicación fallida',
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
export type PublicationResult =
  | { state: 'unavailable' | 'limited' | 'anonymous' }
  | { state: keyof typeof buildLabels; id: string };

/** Server/RLS decide access and idempotency; a successful request is not a deployment. */
export async function requestPublication(
  client: AdminClient,
  requestId = crypto.randomUUID(),
  retryOf?: string,
): Promise<PublicationResult> {
  try {
    const session = await client.auth.getSession();
    if (!session.data.session) return { state: 'anonymous' };
    const { data, error } = await client.functions.invoke('publish-site', {
      body: {
        request_id: requestId,
        trigger_type: retryOf ? 'retry' : 'manual',
        ...(retryOf ? { retry_of: retryOf } : {}),
      },
      headers: { Authorization: 'Bearer ' + session.data.session.access_token },
    });
    if (error)
      return {
        state:
          error.context instanceof Response && error.context.status === 429
            ? 'limited'
            : 'unavailable',
      };
    if (
      data &&
      typeof data === 'object' &&
      Object.hasOwn(buildLabels, data.status) &&
      typeof data.build_id === 'string' &&
      /^[0-9a-f-]{36}$/.test(data.build_id)
    )
      return { state: data.status as keyof typeof buildLabels, id: data.build_id };
    return { state: 'unavailable' };
  } catch {
    return { state: 'unavailable' };
  }
}

export const publicationNotice = (result: PublicationResult): string =>
  'id' in result
    ? buildLabels[result.state]
    : result.state === 'limited'
      ? 'Espera unos segundos antes de solicitar otra publicación.'
      : result.state === 'anonymous'
        ? 'Inicia sesión para solicitar la publicación.'
        : 'Contenido guardado. No se pudo confirmar la solicitud; reintenta para consultar la misma publicación.';

export function watchPublication(
  client: AdminClient,
  id: string,
  notify: (build: Awaited<ReturnType<typeof loadBuilds>>[number] | null) => void,
  { interval = 5000, schedule = setTimeout, cancel = clearTimeout } = {},
) {
  let stopped = false,
    failures = 0,
    timer: ReturnType<typeof setTimeout> | undefined;
  async function poll() {
    if (stopped) return;
    try {
      const { data, error } = await client
        .from('site_builds')
        .select('*')
        .eq('id', id)
        .abortSignal(AbortSignal.timeout(8000))
        .maybeSingle();
      if (stopped) return;
      if (error || !data) throw new Error('Publication unavailable');
      failures = 0;
      notify(data);
      if (!['queued', 'building'].includes(data.status)) {
        stop();
        return;
      }
    } catch {
      if (stopped) return;
      notify(null);
      if (++failures >= 3) {
        stop();
        return;
      }
    }
    if (!stopped)
      timer = schedule(() => {
        void poll();
      }, interval);
  }
  function stop() {
    stopped = true;
    if (timer !== undefined) cancel(timer);
  }
  void poll();
  return stop;
}
