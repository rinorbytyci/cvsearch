import { loadEnv } from "@cvsearch/config";
import { runSampleJob } from "./jobs/sampleJob";
import { runVirusScanJob } from "./jobs/virus-scan";
import { runParseCvJob } from "./jobs/parse-cv";
import { runDataRetentionJob } from "./jobs/data-retention";

async function main() {
  const env = loadEnv();
  const result = await runSampleJob(env);
  console.log("Sample job completed", result);

  const virusScanSummary = await runVirusScanJob(env);
  console.log("Virus scan job summary", virusScanSummary);

  const parseSummary = await runParseCvJob(env);
  console.log("CV parsing job summary", parseSummary);

  const retentionSummary = await runDataRetentionJob(env);
  console.log("Data retention job summary", retentionSummary);
}

main().catch((error) => {
  console.error("Worker failed", error);
  process.exitCode = 1;
});
