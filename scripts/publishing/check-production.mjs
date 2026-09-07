import { currentMain, checkDeployment, MainLookupError } from './health.mjs';
try {
  if (process.argv[2] === '--current-main') {
    if (process.env.GITHUB_ACTIONS === 'true' && !process.env.GITHUB_TOKEN)
      throw new Error('Workflow token missing.');
    await currentMain(process.env.GITHUB_SHA, fetch, process.env.GITHUB_TOKEN);
  } else {
    let result;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        result = await checkDeployment();
        break;
      } catch (error) {
        if (attempt === 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
    console.log(JSON.stringify(result));
  }
} catch (error) {
  console.error(
    error instanceof MainLookupError
      ? error.message
      : 'Pages health or current-main verification failed.',
  );
  process.exitCode = 1;
}
