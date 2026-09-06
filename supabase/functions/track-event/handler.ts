import { endpoint, json, type SafeLog } from '../_shared/http.ts';
import { object, choice, uuid, string } from '../_shared/validation.ts';
import { EdgeError, invalid } from '../_shared/errors.ts';
import { daily, hmac } from '../_shared/crypto.ts';
import { clientSignal, userAgent, referrer } from '../_shared/privacy.ts';
import { accepted } from '../_shared/repository.ts';
import type { EdgeConfig } from '../_shared/env.ts';
import type { Runtime } from '../_shared/runtime.ts';
import { events } from '../_shared/events.ts';
export { events } from '../_shared/events.ts';
export function trackEvent(
  getConfig: () => EdgeConfig,
  runtime: Runtime,
  log?: (entry: SafeLog) => void,
) {
  return endpoint(
    'track-event',
    getConfig,
    async (request, text, config) => {
      const { db } = await runtime.authorize(request, 'publishable');
      const body = object(json(text), [
        'event_id',
        'session_id',
        'event_type',
        'pathname',
        'project_id',
        'post_id',
        'referrer_domain',
      ]);
      const event = choice(body.event_type, events);
      if (event === 'contact_submit') throw new EdgeError(403, 'forbidden');
      const pathname = string(body.pathname, 1, 200);
      if (!/^\/portfolio-alonso\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/){0,2}$/.test(pathname)) invalid();
      const project = body.project_id !== undefined ? uuid(body.project_id) : undefined;
      const post = body.post_id !== undefined ? uuid(body.post_id) : undefined;
      if (
        (project && post) ||
        (['project_view', 'demo_click'].includes(event) && (!project || post)) ||
        (['post_view', 'article_share'].includes(event) && (!post || project))
      )
        invalid();
      // Any public page can contain global CV/social/contact actions. Content IDs
      // still have to match a published resource and its exact path in the RPC.
      const domain =
        body.referrer_domain !== undefined ? string(body.referrer_domain, 1, 253) : null;
      if (domain && !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain)) invalid();
      const now = runtime.now();
      if (
        request.headers.get('dnt') === '1' ||
        request.headers.get('sec-gpc') === '1' ||
        /Googlebot|bingbot|DuckDuckBot|HeadlessChrome|Playwright|HealthCheck/i.test(
          request.headers.get('user-agent') || '',
        )
      )
        return { data: { status: 'accepted' } };
      const agent = userAgent(request);
      accepted(
        await db.event({
          p_event_id: uuid(body.event_id),
          p_event_type: event,
          p_pathname: pathname,
          p_session_hash: await hmac(
            config.analyticsSecret,
            daily(now, 'session', uuid(body.session_id)),
          ),
          p_origin_hash: await hmac(
            config.analyticsRateSecret,
            daily(now, 'analytics-origin', clientSignal(request, config.networkMode)),
          ),
          p_global_hash: await hmac(
            config.analyticsRateSecret,
            daily(now, 'analytics-global', 'site'),
          ),
          ...(project ? { p_project_id: project } : {}),
          ...(post ? { p_post_id: post } : {}),
          ...(domain ? { p_referrer: referrer(domain)! } : {}),
          p_device: agent.device,
          p_browser: agent.browser,
        }),
      );
      return { data: { status: 'accepted' } };
    },
    log,
  );
}
