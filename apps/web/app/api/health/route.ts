import { NextResponse } from "next/server";
import { getEnv } from "@/config/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const env = getEnv();

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      storageBucketConfigured: Boolean(env.S3_BUCKET)
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown environment error";

    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        message
      },
      { status: 500 }
    );
  }
}
