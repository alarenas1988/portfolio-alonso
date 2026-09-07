import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { githubOperator } from './github-operator.mjs';
import { verifyProject, cliJson, cli, ref, env } from './edge-remote.mjs';

assert.equal(process.argv[2], '--configure-f11');
assert.equal(
  execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  'feat/f11-c2-deployment',
);
assert.equal(
  execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  '',
  'Commit the reviewed configuration first.',
);
const gate = JSON.parse(readFileSync('.tools/f11/local-gate.json', 'utf8'));
assert(
  gate.passed &&
    gate.commit === execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
);
const project = verifyProject(),
  github = githubOperator(),
  base = 'repos/alarenas1988/portfolio-alonso';
assert.equal(
  github.api(base + '/branches/main').commit.sha,
  execFileSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).trim(),
  'Remote main changed since the reviewed base.',
);
const edgeNames = cliJson(['secrets', 'list', '--project-ref', ref]).map((value) => value.name);
assert(edgeNames.includes('GITHUB_FINE_GRAINED_TOKEN'), 'User-managed dispatch token is required.');
const githubNames = github.api(base + '/actions/secrets').secrets.map((value) => value.name);
const secretName = 'BUILD_CALLBACK_HMAC_SECRET';
assert.equal(
  edgeNames.includes(secretName),
  githubNames.includes(secretName),
  'Partially configured callback secret: reconcile it explicitly, do not rotate silently.',
);

if (!edgeNames.includes(secretName)) {
  const value = randomBytes(32).toString('hex');
  // Supabase CLI accepts env-file, not stdin. Use a restricted temporary file outside
  // the repo, delete it immediately; the GitHub secret is transmitted via stdin.
  const folder = mkdtempSync(join(tmpdir(), 'portfolio-c2-secret-'));
  const file = join(folder, 'callback.env');
  try {
    if (process.platform === 'win32')
      execFileSync(
        'icacls',
        [
          folder,
          '/inheritance:r',
          '/grant:r',
          `${process.env.USERDOMAIN}\\${process.env.USERNAME}:(OI)(CI)F`,
        ],
        { stdio: 'pipe', windowsHide: true },
      );
    writeFileSync(file, secretName + '=' + value + '\n', { mode: 0o600 });
    cli(['secrets', 'set', '--project-ref', ref, '--env-file', file]);
    github.command(['secret', 'set', secretName, '--repo', 'alarenas1988/portfolio-alonso'], value);
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* File may not have been created. */
    }
    rmdirSync(folder);
  }
}
const variables = github.api(base + '/actions/variables').variables;
for (const name of ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
  assert(env[name]);
  const previous = variables.find((variable) => variable.name === name);
  if (previous && previous.value !== env[name])
    throw new Error('Existing public variable differs; inspect before overwriting.');
  if (!previous) github.api(base + '/actions/variables', 'POST', { name, value: env[name] });
}
let pages;
try {
  pages = github.api(base + '/pages');
} catch (error) {
  if (!error.message.endsWith('HTTP 404')) throw error;
}
if (pages)
  assert.equal(pages.build_type, 'workflow', 'Existing Pages publishing strategy differs.');
else pages = github.api(base + '/pages', 'POST', { build_type: 'workflow' });
const environments = github.api(base + '/environments').environments;
if (!environments.some((value) => value.name === 'github-pages'))
  github.api(base + '/environments/github-pages', 'PUT', {
    deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
  });
const environment = github.api(base + '/environments/github-pages');
// Creating Pages may create the standard environment itself. Restrict only a new,
// unprotected environment; do not replace reviewers or existing custom protection.
if (!environment.deployment_branch_policy && !environment.protection_rules?.length)
  github.api(base + '/environments/github-pages', 'PUT', {
    deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
  });
const branches = github.api(
  base + '/environments/github-pages/deployment-branch-policies',
).branch_policies;
if (!branches.some((value) => value.name === 'main'))
  github.api(base + '/environments/github-pages/deployment-branch-policies', 'POST', {
    name: 'main',
    type: 'branch',
  });
const evidence = {
  date: new Date().toISOString(),
  account: github.account,
  project,
  pages: { build_type: pages.build_type, html_url: pages.html_url },
  environment: 'github-pages',
  allowed_branch: 'main',
  variables: ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
  shared_secret: secretName,
  dispatch_token_present: true,
  workflows_pushed: false,
  edge_functions_deployed: [],
  deployment_verified: false,
};
writeFileSync('.tools/f11/platform-configured.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
