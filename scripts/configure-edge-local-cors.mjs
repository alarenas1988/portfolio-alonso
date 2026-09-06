import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { localStatus, prepareEdgeEnvironment } from './edge-local.mjs';

/** Configure only the local functions service through Kong's supported DB-less API.
 * The complete gateway document contains credentials: keep it in memory and never log it.
 */
export function configureLocalEdgeCors() {
  localStatus();
  const env = prepareEdgeEnvironment();
  const container = 'supabase_kong_portfolio-alonso-baseline-local';
  const previous = spawnSync('docker', ['exec', container, 'cat', '/home/kong/kong.yml'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (previous.status !== 0)
    throw new Error('Cannot read the isolated local gateway configuration.');
  const document = previous.stdout;
  // Bound the service explicitly; never alter Auth/REST/Storage gateway plugins.
  const start = document.indexOf('  - name: functions-v1\n');
  if (start < 0) throw new Error('Unexpected local functions gateway layout.');
  const next = document.indexOf('\n  - name: ', start + 1);
  const end = next < 0 ? document.length : next;
  const service = document.slice(start, end);
  const cors = / {6}- name: cors\r?\n(?: {8}[^\n]*\n)*/g;
  if ([...service.matchAll(cors)].length !== 1)
    throw new Error('Expected one local functions CORS plugin.');
  const replacement = [
    '      - name: cors',
    '        config:',
    `          origins: ${JSON.stringify(env.PORTFOLIO_ALLOWED_ORIGINS.split(','))}`,
    '          methods: [POST, OPTIONS]',
    '          headers: [apikey, authorization, content-type, idempotency-key, x-client-info, x-request-id, x-form-started-at]',
    '          exposed_headers: [X-Request-Id, Retry-After]',
    '          credentials: false',
    '          preflight_continue: true',
    '          max_age: 600',
    '',
  ].join('\n');
  const updated =
    document.slice(0, start) + service.replace(cors, replacement) + document.slice(end);
  const script =
    'local h=require("resty.http").new(); h:set_timeout(10000); local r,e=h:request_uri("http://127.0.0.1:8001/config",{method="POST",body=io.read("*a"),headers={["Content-Type"]="application/json"}}); if not r or r.status~=201 then os.exit(1) end';
  const result = spawnSync('docker', ['exec', '-i', container, 'resty', '-e', script], {
    input: JSON.stringify({ config: updated }),
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error('Local gateway rejected the functions CORS configuration.');
  return { service: 'functions-v1', origins: env.PORTFOLIO_ALLOWED_ORIGINS.split(',') };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(configureLocalEdgeCors()));
}
