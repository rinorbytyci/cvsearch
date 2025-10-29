import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { cvEntitiesCollection, type CvEntityType } from "@/lib/db/cv-entities";
import { cvsCollection, cvVersionsCollection } from "@/lib/db/cv";

const ENTITY_TYPES = [
  "education",
  "experience",
  "skill",
  "language",
  "certification",
  "summary"
] as const satisfies readonly CvEntityType[];

const manualEntitySchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  label: z.string().trim().min(1),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.any()).optional()
});

const manualPayloadSchema = z.object({
  versionId: z.string().optional(),
  entities: z.array(manualEntitySchema)
});

const reparsePayloadSchema = z.object({
  versionId: z.string().optional(),
  force: z.boolean().optional()
});

const EMBEDDING_DIMENSIONS = 256;

function computeEmbedding(text: string) {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

  for (const token of tokens) {
    let hash = 0;
    for (let index = 0; index < token.length; index += 1) {
      hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
    }

    const bucket = hash % EMBEDDING_DIMENSIONS;
    vector[bucket] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

async function resolveCvAndVersion(cvIdParam: string, versionIdParam?: string) {
  let cvId: ObjectId;
  try {
    cvId = new ObjectId(cvIdParam);
  } catch {
    throw new Error("Invalid CV identifier");
  }

  const cvs = await cvsCollection();
  const cvDocument = await cvs.findOne({ _id: cvId });
  if (!cvDocument) {
    throw new Error("CV not found");
  }

  let versionId = cvDocument.latestVersionId;
  if (versionIdParam) {
    try {
      versionId = new ObjectId(versionIdParam);
    } catch {
      throw new Error("Invalid version identifier");
    }
  }

  if (!versionId) {
    throw new Error("CV does not have an uploaded version to parse");
  }

  const versions = await cvVersionsCollection();
  const version = await versions.findOne({ _id: versionId, cvId: cvDocument._id });

  if (!version) {
    throw new Error("CV version not found");
  }

  return { cvId: cvDocument._id!, versionId: version._id, versionDoc: version };
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let payload: z.infer<typeof reparsePayloadSchema> | undefined;

  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = await request.json();
      const parsed = reparsePayloadSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      payload = parsed.data;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
  }

  try {
    const { cvId, versionId } = await resolveCvAndVersion(params.id, payload?.versionId);

    const versions = await cvVersionsCollection();
    const cvs = await cvsCollection();

    const updateResult = await versions.updateOne(
      { _id: versionId },
      {
        $set: {
          parseStatus: "pending",
          parsedAt: null,
          parseError: null
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Unable to queue CV for parsing" }, { status: 404 });
    }

    await cvs.updateOne(
      { _id: cvId },
      {
        $set: {
          "versionHistory.$[entry].parseStatus": "pending",
          "versionHistory.$[entry].parsedAt": null
        }
      },
      { arrayFilters: [{ "entry.versionId": versionId }] }
    );

    return NextResponse.json({ status: "queued", versionId: versionId.toHexString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to queue CV parsing";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = manualPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { cvId, versionId } = await resolveCvAndVersion(params.id, parsed.data.versionId);
    const entitiesCollection = await cvEntitiesCollection();
    const now = new Date();

    await entitiesCollection.deleteMany({ cvId, versionId, source: "manual" });

    if (parsed.data.entities.length) {
      const docs = parsed.data.entities.map((entity) => ({
        cvId,
        versionId,
        entityType: entity.entityType,
        label: entity.label,
        confidence: entity.confidence ?? 0.95,
        source: "manual" as const,
        metadata: {
          ...(entity.metadata ?? {}),
          manual: true
        },
        embedding: computeEmbedding(entity.label),
        createdAt: now,
        updatedAt: now
      }));

      await entitiesCollection.insertMany(docs);
    }

    const versions = await cvVersionsCollection();
    await versions.updateOne(
      { _id: versionId },
      {
        $set: {
          parseStatus: "parsed",
          parsedAt: now,
          parseError: null
        }
      }
    );

    const cvs = await cvsCollection();
    await cvs.updateOne(
      { _id: cvId },
      {
        $set: {
          "versionHistory.$[entry].parseStatus": "parsed",
          "versionHistory.$[entry].parsedAt": now
        }
      },
      { arrayFilters: [{ "entry.versionId": versionId }] }
    );

    const savedEntities = await entitiesCollection
      .find({ cvId, versionId })
      .sort({ source: -1, confidence: -1 })
      .toArray();

    return NextResponse.json({
      status: "updated",
      entities: savedEntities.map((entity) => ({
        id: entity._id?.toHexString() ?? null,
        entityType: entity.entityType,
        label: entity.label,
        confidence: entity.confidence,
        source: entity.source,
        metadata: entity.metadata ?? {},
        embedding: entity.embedding
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update parsed entities";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
