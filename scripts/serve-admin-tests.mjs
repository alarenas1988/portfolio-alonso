import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { prepareAdminFixtures, cleanupAdminFixtures } from './admin-local-fixtures.mjs';
import { checkAdminStatic } from './check-admin-static.mjs';
const fixture = await prepareAdminFixtures();
const env = {
  ...process.env,
  ...fixture.env,
  ASTRO_TELEMETRY_DISABLED: '1',
  ASTRO_PREVIEW_BACKGROUND: '0',
};
const astro = 'node_modules/astro/bin/astro.mjs',
  output = '.tools/admin-e2e-dist';
let preview;
try {
  const build = spawn(process.execPath, [astro, 'build', '--outDir', output], {
    env,
    stdio: 'inherit',
  });
  const [code] = await once(build, 'exit');
  if (code !== 0) throw new Error('Admin fixture build failed');
  checkAdminStatic(output, [
    ...Object.values(fixture.state.actors).flatMap((a) => [a.id, a.email, a.password]),
    fixture.state.project,
    fixture.state.post,
    fixture.state.message,
    'Automatización de procesos · fixture',
    'Consulta local de prueba',
    'cms-fixture@example.test',
  ]);
  preview = spawn(
    process.execPath,
    [astro, 'preview', '--outDir', output, '--host', 'localhost', '--port', '4321'],
    { env, stdio: 'inherit' },
  );
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => preview.kill());
  await once(preview, 'exit');
} finally {
  await cleanupAdminFixtures();
}
