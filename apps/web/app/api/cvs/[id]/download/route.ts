import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import {
  finalizeDocumentAccess,
  guardDocumentAccess,
  recordDocumentAccessFailure
} from "@/app/api/middleware/privacy";
import { cvsCollection, cvVersionsCollection } from "@/lib/db/cv";
import { getEnv } from "@/config/env";

function resolveVersionId(raw?: string | null) {
  if (!raw) {
    return null;
  }

  if (ObjectId.isValid(raw)) {
    try {
      return new ObjectId(raw);
    } catch {
      return null;
    }
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const versionIdParam = request.nextUrl.searchParams.get("versionId");
  const guardResult = await guardDocumentAccess(request, {
    action: "download",
    consultantId: params.id,
    versionId: versionIdParam
  });

  if (guardResult instanceof NextResponse) {
    return guardResult;
  }

  const context = guardResult;

  try {
    const cvs = await cvsCollection();
    const versions = await cvVersionsCollection();
    const cv = await cvs.findOne({ _id: context.consultantId });

    if (!cv) {
      await recordDocumentAccessFailure(request, context, new Error("CV not found"));
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    const resolvedVersionId = resolveVersionId(versionIdParam);
    const targetVersionId = resolvedVersionId ?? cv.latestVersionId ?? null;

    if (!targetVersionId) {
      await recordDocumentAccessFailure(request, context, new Error("No CV version available"));
      return NextResponse.json({ error: "No CV version available" }, { status: 404 });
    }

    const version = await versions.findOne({ _id: targetVersionId });

    if (!version) {
      await recordDocumentAccessFailure(request, context, new Error("CV version not found"));
      return NextResponse.json({ error: "CV version not found" }, { status: 404 });
    }

    const env = getEnv();
    const downloadDescriptor = {
      versionId: version._id.toHexString(),
      objectKey: version.objectKey,
      bucket: env.S3_BUCKET,
      checksum: version.checksum,
      contentType: version.contentType,
      size: version.size,
      originalFilename: version.originalFilename
    };

    const response = NextResponse.json({
      download: downloadDescriptor,
      message: "Request a signed URL from the storage gateway to complete download"
    });

    await finalizeDocumentAccess(request, context, response);
    return response;
  } catch (error) {
    await recordDocumentAccessFailure(request, context, error);
    const message = error instanceof Error ? error.message : "Unable to prepare download";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
