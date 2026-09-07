import { spawnSync } from 'node:child_process';

// Operator-only tooling, never imported into the site or deployed to Edge Functions.
export function githubOperator() {
  const result = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\npath=alarenas1988/portfolio-alonso.git\n\n',
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const token = result.stdout
    ?.split(/\r?\n/)
    .find((line) => line.startsWith('password='))
    ?.slice(9);
  if (result.status !== 0 || !token)
    throw new Error('Authorized GitHub operator credential unavailable.');
  const env = { ...process.env, GH_TOKEN: token };
  delete env.GH_DEBUG;
  delete env.DEBUG;
  function command(args, input) {
    const result = spawnSync('gh', args, {
      input,
      env,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      let status;
      try {
        status = JSON.parse(result.stdout).status;
      } catch {
        /* Never print credential/provider output. */
      }
      throw new Error('GitHub operation failed' + (status ? ': HTTP ' + status : ''));
    }
    return result.stdout;
  }
  function api(path, method = 'GET', body) {
    const args = ['api', path, '--method', method];
    if (body !== undefined) args.push('--input', '-');
    const text = command(args, body === undefined ? undefined : JSON.stringify(body));
    return text.trim() ? JSON.parse(text) : null;
  }
  const user = api('user');
  const repository = api('repos/alarenas1988/portfolio-alonso');
  if (
    user.login !== 'alarenas1988' ||
    !repository.permissions?.admin ||
    repository.default_branch !== 'main'
  )
    throw new Error('Expected repository administrator on the approved main repository.');
  return { api, command, account: user.login };
}
