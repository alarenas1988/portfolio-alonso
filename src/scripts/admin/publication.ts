import type { AdminClient } from '../../lib/admin/repository.ts';
import {
  requestPublication,
  publicationNotice,
  watchPublication,
  buildLabels,
} from '../../lib/admin/builds.ts';
import { feedback } from '../../lib/admin/dom.ts';

/** One request UUID survives transport errors. Poll only an identified active build. */
export function publicationController(
  client: AdminClient,
  status: HTMLElement,
  refresh?: () => void,
) {
  let requestId = crypto.randomUUID(),
    sending = false,
    disposed = false;
  let stopWatch = () => {};
  let previousIntent: string | undefined;
  function observe(id: string) {
    stopWatch();
    stopWatch = watchPublication(client, id, (build) => {
      if (disposed) return;
      if (!build) {
        feedback(
          status,
          'No se pudo consultar la publicación. Los datos guardados se conservan; consulta Publicaciones para actualizar.',
          'error',
        );
        return;
      }
      feedback(
        status,
        buildLabels[build.status as keyof typeof buildLabels],
        build.status === 'failed' ? 'error' : 'info',
      );
      if (['success', 'failed'].includes(build.status)) {
        requestId = crypto.randomUUID();
        refresh?.();
      }
    });
  }
  function dispose() {
    disposed = true;
    stopWatch();
    window.removeEventListener('admin-dispose', dispose);
  }
  window.addEventListener('admin-dispose', dispose, { once: true });
  return {
    dispose,
    observe,
    async submit(retryOf?: string, editorialRevision = '') {
      if (sending || disposed) return;
      // This signature stays only in memory. Changed editorial data needs a fresh
      // snapshot; retrying identical data after a lost response keeps the UUID.
      const intent = JSON.stringify([retryOf ?? null, editorialRevision]);
      if (previousIntent !== intent) {
        stopWatch();
        requestId = crypto.randomUUID();
        previousIntent = intent;
      }
      sending = true;
      feedback(status, 'Solicitando publicación…');
      try {
        const result = await requestPublication(client, requestId, retryOf);
        if (disposed) return;
        feedback(status, publicationNotice(result), result.state === 'failed' ? 'error' : 'info');
        if ('id' in result) {
          if (['queued', 'building'].includes(result.state)) observe(result.id);
          else requestId = crypto.randomUUID();
          refresh?.();
        }
      } finally {
        sending = false;
      }
    },
  };
}
