import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { verifyProject, verifyLink, sql, cli } from './edge-remote.mjs';

assert.equal(process.argv[2], '--read-only');
const project = verifyProject();
verifyLink();
mkdirSync('.tools/f10b', { recursive: true });
mkdirSync('.tools/f7', { recursive: true });
// Reuse the approved catalog/types comparator. Its historical flag only enables
// read-only inspection; it does not deploy, create users, or run fixtures.
const compare = spawnSync(process.execPath, ['scripts/verify-admin-remote.mjs', '--verify-f7'], {
  encoding: 'utf8',
  windowsHide: true,
  timeout: 180000,
});
assert.equal(compare.status, 0, 'Read-only catalog/types comparison failed; inspect locally.');
const catalog = JSON.parse(readFileSync('.tools/f7/post-deploy.json', 'utf8'));
writeFileSync('.tools/f10b/catalog.json', JSON.stringify(catalog, null, 2));
const audit = sql(`begin read only;select jsonb_build_object(
 'observed_at',now(),'postgres',current_setting('server_version'),'cron_timezone',current_setting('cron.timezone',true),
 'jobs',(select jsonb_agg(jsonb_build_object('id',jobid,'name',jobname,'schedule',schedule,'command',command,'active',active,'username',username) order by jobid) from cron.job where jobname like 'portfolio-%'),
 'runs',(select jsonb_agg(to_jsonb(r) order by start_time desc) from (
   select d.jobid,d.runid,j.jobname,d.status,d.start_time,d.end_time,
   extract(epoch from(d.end_time-d.start_time))*1000 as duration_ms,
   case when d.status='succeeded' then d.return_message else 'Failure; inspect platform log securely' end as message
   from cron.job_run_details d join cron.job j using(jobid) where j.jobname like 'portfolio-%' order by d.start_time desc limit 32) r),
 'rows',jsonb_build_object('raw',(select count(*) from public.analytics_events),'daily',(select count(*) from public.analytics_daily),'content',(select count(*) from public.analytics_daily_content),'dimensions',(select count(*) from private.analytics_daily_dimensions),'sessions',(select count(*) from private.analytics_daily_sessions))) as audit;rollback;`)[0]
  .audit;
const job = audit.jobs.find((j) => j.name === 'portfolio-analytics-maintenance');
assert(job?.active && job.schedule === '7 * * * *');
assert.equal(job.command, 'set local role service_role; select public.maintain_analytics()');
assert.equal(audit.jobs.length, 2, 'Do not silently accept a duplicate portfolio cron');
const latest = audit.runs.find((r) => r.jobid === job.id);
assert(latest?.status === 'succeeded', 'Automatic maintenance success is still pending');
assert.equal(new Date(latest.start_time).getUTCMinutes(), 7);
assert(['GMT', 'UTC'].includes(audit.cron_timezone));
const observed = new Date(audit.observed_at);
const next = new Date(observed);
next.setUTCMinutes(7, 0, 0);
if (next <= observed) next.setUTCHours(next.getUTCHours() + 1);
const dry = JSON.parse(cli(['db', 'push', '--linked', '--dry-run', '--skip-vault']));
assert.deepEqual(dry.migrations, []);
const result = {
  project,
  ...audit,
  automatic_run_observed: true,
  evidence_source: 'Existing cron.job_run_details; no manual invocation or reschedule',
  next_nominal_utc: next.toISOString(),
  next_run_note: 'Schedule estimate, not an execution guarantee',
  dry_run: dry,
  remote_mutations: false,
};
writeFileSync('.tools/f10b/remote-audit.json', JSON.stringify(result, null, 2));
console.log(
  JSON.stringify(
    {
      project,
      latest_automatic_run: latest,
      next_nominal_utc: result.next_nominal_utc,
      catalog_matches: true,
      types_match: true,
      pending_migrations: 0,
      remote_mutations: false,
    },
    null,
    2,
  ),
);
