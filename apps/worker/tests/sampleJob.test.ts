import { describe, expect, it } from "vitest";
import { runSampleJob } from "../src/jobs/sampleJob";

describe("runSampleJob", () => {
  it("returns execution metadata", async () => {
    const result = await runSampleJob({
      NODE_ENV: "test",
      MONGODB_URI: "https://example.com",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
      S3_REGION: "region",
      S3_BUCKET: "bucket"
    });

    expect(result.bucket).toBe("bucket");
    expect(result.mongodb).toBe("https://example.com");
  });
});
