import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { listFiles } from './files.mjs';

const directory = resolve(process.argv[2] || 'dist');
const privateNames = [
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SECRET_KEYS',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ACCESS_TOKEN',
  'GITHUB_FINE_GRAINED_TOKEN',
  'GITHUB_TOKEN',
  'ANALYTICS_HASH_SECRET',
  'RATE_LIMIT_HASH_SECRET',
  'BUILD_CALLBACK_SECRET',
  'EMAIL_PROVIDER_SECRET',
  'CONTACT_RATE_LIMIT_HMAC_SECRET',
  'ANALYTICS_HMAC_SECRET',
  'ANALYTICS_RATE_LIMIT_HMAC_SECRET',
  'BUILD_CALLBACK_HMAC_SECRET',
];
const canaries = privateNames
  .map((name) => process.env[name])
  .filter((value) => value && value.length >= 8);
const patterns = [
  /sb_secret_[A-Za-z0-9_-]+/,
  /\bsbp_[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]+/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
let failures = 0;
const files = await listFiles(directory);
if (!files.length) throw new Error('No build artifacts to inspect.');
for (const file of files) {
  const content = await readFile(file, 'utf8');
  const jwtSecrets = [
    ...content.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g),
  ].some((match) => {
    try {
      return (
        JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')).role === 'service_role'
      );
    } catch {
      return false;
    }
  });
  if (
    patterns.some((pattern) => pattern.test(content)) ||
    canaries.some((value) => content.includes(value)) ||
    jwtSecrets ||
    /(?:^|[/\\])\.env(?:\.|$)/.test(relative(directory, file))
  ) {
    console.error(`Private material detected in ${relative(directory, file)} (value redacted).`);
    failures++;
  }
}
if (failures) process.exitCode = 1;
else console.log(`Secret scan passed: ${files.length} build artifacts.`);
