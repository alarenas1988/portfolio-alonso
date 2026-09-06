import { spawn } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { localStatus, prepareEdgeEnvironment, root, cli } from './edge-local.mjs';
import { configureLocalEdgeCors } from './configure-edge-local-cors.mjs';
const status = localStatus();
const env = prepareEdgeEnvironment();
const sensitive = [...Object.values(status), ...Object.values(env)].filter(
  (value) => typeof value === 'string' && value.length > 25,
);
const log = new URL('../.tools/edge-runtime.log', import.meta.url);
writeFileSync(log, '');
const child = spawn(
  process.execPath,
  [cli, 'functions', 'serve', '--env-file', '.env.edge.local'],
  { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
);
function record(chunk) {
  let text = String(chunk);
  for (const value of sensitive) text = text.replaceAll(value, '[redacted]');
  text = text.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted-jwt]');
  appendFileSync(log, text);
}
function runtimeOutput(chunk) {
  record(chunk);
  if (String(chunk).includes('Serving functions')) {
    try {
      configureLocalEdgeCors();
      console.log('Local functions gateway uses the explicit CORS allowlist.');
    } catch {
      console.error('Local CORS configuration failed; inspect the local gateway.');
      child.kill();
      process.exitCode = 1;
    }
  }
}
child.stdout.on('data', runtimeOutput);
child.stderr.on('data', runtimeOutput);
child.on('error', () => {
  console.error('Local Edge runtime failed to start.');
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code || 0;
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    child.kill();
  });
console.log(
  'Local Edge Runtime starting on loopback; sanitized diagnostics: .tools/edge-runtime.log',
);
