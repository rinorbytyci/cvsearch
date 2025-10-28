import { beforeEach, describe, expect, it } from "vitest";
import { getEnv } from "../src/config/env";

describe("getEnv", () => {
  beforeEach(() => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/cvsearch";
    process.env.S3_ACCESS_KEY_ID = "key";
    process.env.S3_SECRET_ACCESS_KEY = "secret";
    process.env.S3_REGION = "region";
    process.env.S3_BUCKET = "bucket";
  });

  it("returns validated environment variables", () => {
    const env = getEnv();
    expect(env.MONGODB_URI).toBe("mongodb://localhost:27017/cvsearch");
    expect(env.S3_BUCKET).toBe("bucket");
  });
});
