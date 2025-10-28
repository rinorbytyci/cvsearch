import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";

import { ParsedCvClient } from "./ParsedCvClient";
import { cvEntitiesCollection } from "@/lib/db/cv-entities";
import { cvsCollection, cvVersionsCollection } from "@/lib/db/cv";

interface PageProps {
  params: { id: string };
}

export default async function ParsedCvReviewPage({ params }: PageProps) {
  let cvId: ObjectId;
  try {
    cvId = new ObjectId(params.id);
  } catch {
    notFound();
  }

  const cvs = await cvsCollection();
  const cv = await cvs.findOne({ _id: cvId });

  if (!cv) {
    notFound();
  }

  const versions = await cvVersionsCollection();
  const latestVersion = cv.latestVersionId
    ? await versions.findOne({ _id: cv.latestVersionId })
    : null;

  const entitiesCollection = await cvEntitiesCollection();
  const entities = await entitiesCollection
    .find({ cvId })
    .sort({ source: -1, confidence: -1 })
    .toArray();

  return (
    <ParsedCvClient
      cvId={cv._id!.toHexString()}
      versionId={latestVersion?._id?.toHexString() ?? null}
      consultantName={cv.consultant.name}
      parseStatus={latestVersion?.parseStatus ?? "pending"}
      parsedAt={latestVersion?.parsedAt ? latestVersion.parsedAt.toISOString() : null}
      parseError={latestVersion?.parseError ?? null}
      entities={entities.map((entity) => ({
        id: entity._id?.toHexString() ?? null,
        entityType: entity.entityType,
        label: entity.label,
        confidence: entity.confidence,
        source: entity.source,
        metadata: entity.metadata ?? {},
        embedding: entity.embedding ?? null
      }))}
    />
  );
}
