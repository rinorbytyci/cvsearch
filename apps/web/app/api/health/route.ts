import { NextResponse } from "next/server";
import { getEnv } from "@/config/env";

export async function GET() {
  const env = getEnv();

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    storageBucketConfigured: Boolean(env.S3_BUCKET)
  });
}
