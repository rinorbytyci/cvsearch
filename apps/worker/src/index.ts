import { loadEnv } from "@cvsearch/config";
import { runSampleJob } from "./jobs/sampleJob";

async function main() {
  const env = loadEnv();
  const result = await runSampleJob(env);
  console.log("Sample job completed", result);
}

main().catch((error) => {
  console.error("Worker failed", error);
  process.exitCode = 1;
});
