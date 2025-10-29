import { NextRequest, NextResponse } from "next/server";

import {
  finalizeDocumentAccess,
  guardDocumentAccess,
  recordDocumentAccessFailure
} from "@/app/api/middleware/privacy";
import { cvsCollection } from "@/lib/db/cv";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const guardResult = await guardDocumentAccess(request, {
    action: "view",
    consultantId: params.id
  });

  if (guardResult instanceof NextResponse) {
    return guardResult;
  }

  const context = guardResult;

  try {
    const cvs = await cvsCollection();
    const cv = await cvs.findOne({ _id: context.consultantId });

    if (!cv) {
      await recordDocumentAccessFailure(request, context, new Error("CV not found"));
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    const response = NextResponse.json({
      id: cv._id?.toHexString(),
      consultant: {
        ...cv.consultant,
        languages: cv.consultant.languages ?? []
      },
      availability: {
        ...cv.availability,
        availableFrom: cv.availability.availableFrom
          ? cv.availability.availableFrom.toISOString()
          : null
      },
      skills: cv.skills ?? [],
      tags: cv.tags ?? [],
      notes: cv.notes ?? null,
      languagePreference: cv.languagePreference ?? null,
      retention: cv.retention
        ? {
            status: cv.retention.status,
            flaggedAt: cv.retention.flaggedAt ? cv.retention.flaggedAt.toISOString() : null,
            purgeScheduledFor: cv.retention.purgeScheduledFor
              ? cv.retention.purgeScheduledFor.toISOString()
              : null,
            purgedAt: cv.retention.purgedAt ? cv.retention.purgedAt.toISOString() : null,
            warningSentAt: cv.retention.warningSentAt
              ? cv.retention.warningSentAt.toISOString()
              : null,
            reason: cv.retention.reason ?? null
          }
        : null,
      versionHistory: (cv.versionHistory ?? []).map((version) => ({
        versionId: version.versionId.toHexString(),
        objectKey: version.objectKey,
        checksum: version.checksum,
        createdAt: version.createdAt.toISOString(),
        size: version.size,
        contentType: version.contentType,
        uploadedBy: version.uploadedBy ?? null,
        virusScanStatus: version.virusScanStatus,
        virusScannedAt: version.virusScannedAt ? version.virusScannedAt.toISOString() : null,
        parseStatus: version.parseStatus,
        parsedAt: version.parsedAt ? version.parsedAt.toISOString() : null
      })),
      createdAt: cv.createdAt.toISOString(),
      updatedAt: cv.updatedAt.toISOString()
    });

    await finalizeDocumentAccess(request, context, response);
    return response;
  } catch (error) {
    await recordDocumentAccessFailure(request, context, error);
    const message = error instanceof Error ? error.message : "Unable to fetch CV";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
