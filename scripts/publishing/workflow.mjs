import { readFileSync } from 'node:fs';
import { buildIdentity, repository, sendSigned } from './contract.mjs';

const operation = process.argv[2];
try {
  if (operation === 'reconcile') {
    await sendSigned(
      process.env.BUILD_STATUS_URL,
      { action: 'reconcile' },
      process.env.BUILD_CALLBACK_HMAC_SECRET,
    );
  } else {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const buildId = buildIdentity(process.env.GITHUB_EVENT_NAME, event, process.env);
    if (operation === 'validate') {
      console.log('Approved main and publishing payload verified.');
    } else if (buildId) {
      if (!['building', 'finish'].includes(operation))
        throw new Error('Unsupported callback operation.');
      // Edge checks GitHub's run/jobs/deployment evidence. No caller-supplied success flag.
      await sendSigned(
        process.env.BUILD_STATUS_URL,
        {
          action: 'observe',
          build_id: buildId,
          run_id: Number(process.env.GITHUB_RUN_ID),
          run_attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
          phase: operation,
          repository,
        },
        process.env.BUILD_CALLBACK_HMAC_SECRET,
      );
    } else console.log('Code/manual deployment: no CMS build callback required.');
  }
} catch {
  console.error(
    'Publishing contract or callback failed; inspect the bounded reconciliation status.',
  );
  process.exitCode = 1;
}
