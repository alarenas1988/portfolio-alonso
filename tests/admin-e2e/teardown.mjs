import { cleanupAdminFixtures } from '../../scripts/admin-local-fixtures.mjs';
export default async function teardown() {
  await cleanupAdminFixtures();
}
