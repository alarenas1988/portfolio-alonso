import { currentMain, checkDeployment } from './health.mjs';
try {
  if (process.argv[2] === '--current-main') await currentMain(process.env.GITHUB_SHA);
  else {
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
} catch {
  console.error('Pages health or current-main verification failed.');
  process.exitCode = 1;
}
