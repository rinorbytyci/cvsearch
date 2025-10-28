import type { AppEnv } from "@cvsearch/config";

export async function runSampleJob(env: AppEnv) {
  return {
    mongodb: env.MONGODB_URI,
    bucket: env.S3_BUCKET,
    executedAt: new Date().toISOString()
  };
}
