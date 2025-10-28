import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { promisify } from "node:util";
import textract from "textract";
import { MongoClient, ObjectId } from "mongodb";
import type { AppEnv } from "@cvsearch/config";

export type CvParseStatus = "pending" | "processing" | "parsed" | "error";
export type VirusScanStatus = "pending" | "queued" | "scanning" | "clean" | "infected" | "error";

interface CvVersionDocument {
  _id: ObjectId;
  cvId: ObjectId;
  objectKey: string;
  checksum: string;
  size: number;
  contentType: string;
  originalFilename: string;
  metadata: { tags?: string[]; notes?: string | null };
  virusScanStatus: VirusScanStatus;
  virusQueuedAt?: Date;
  virusScannedAt?: Date;
  virusScanResultMessage?: string | null;
  parseStatus: CvParseStatus;
  parsedAt?: Date;
  parseError?: string | null;
  createdAt: Date;
}

interface CvEntityDocument {
  _id?: ObjectId;
  cvId: ObjectId;
  versionId: ObjectId;
  entityType: "education" | "experience" | "skill" | "language" | "certification" | "summary";
  label: string;
  confidence: number;
  source: "parser" | "manual";
  metadata?: Record<string, unknown>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

interface ParseCvJobOptions {
  batchSize?: number;
  parserVersion?: string;
  force?: boolean;
}

interface ParseCvJobSummary {
  processed: number;
  parsed: number;
  failed: number;
  skipped: number;
}

const extractFromBuffer = promisify(textract.fromBufferWithMime);
const EMBEDDING_DIMENSIONS = 256;

function hashToken(token: string) {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function computeEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

  for (const token of tokens) {
    const index = hashToken(token) % EMBEDDING_DIMENSIONS;
    vector[index] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    throw new Error("Unable to download CV content: empty body");
  }

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  const maybeWebStream = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof maybeWebStream?.transformToByteArray === "function") {
    const arr = await maybeWebStream.transformToByteArray();
    return Buffer.from(arr);
  }

  const streamLike = body as AsyncIterable<Uint8Array | Buffer | string>;
  if (typeof (streamLike as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of streamLike) {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
      } else if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else {
        chunks.push(Buffer.from(chunk));
      }
    }
    return Buffer.concat(chunks);
  }

  throw new Error("Unsupported object body type returned from storage");
}

interface SectionDefinition {
  type: CvEntityDocument["entityType"];
  aliases: string[];
}

const SECTION_DEFINITIONS: SectionDefinition[] = [
  { type: "summary", aliases: ["summary", "profile", "about", "professional summary"] },
  { type: "education", aliases: ["education", "academic", "studies"] },
  {
    type: "experience",
    aliases: ["experience", "work experience", "professional experience", "employment history"]
  },
  { type: "skill", aliases: ["skills", "technical skills", "competencies", "expertise"] },
  { type: "language", aliases: ["languages", "spoken languages"] },
  { type: "certification", aliases: ["certifications", "certification", "licenses"] }
];

function normalizeLine(line: string) {
  return line.replace(/[\s•]+/g, " ").trim();
}

function detectSection(line: string) {
  const normalized = line.toLowerCase().replace(/[:]+$/, "").trim();
  for (const definition of SECTION_DEFINITIONS) {
    if (definition.aliases.some((alias) => normalized === alias)) {
      return definition.type;
    }
  }
  return null;
}

function extractEntities(text: string, parserVersion: string) {
  const sections = new Map<CvEntityDocument["entityType"], string[]>();
  SECTION_DEFINITIONS.forEach((definition) => {
    sections.set(definition.type, []);
  });

  let currentSection: CvEntityDocument["entityType"] | null = "summary";
  const lines = text
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  for (const rawLine of lines) {
    const detected = detectSection(rawLine);
    if (detected) {
      currentSection = detected;
      continue;
    }

    if (!currentSection) {
      currentSection = "summary";
    }

    const store = sections.get(currentSection) ?? [];
    store.push(rawLine);
    sections.set(currentSection, store);
  }

  const entities: Omit<CvEntityDocument, "_id" | "cvId" | "versionId">[] = [];

  const summaryLines = sections.get("summary") ?? [];
  if (summaryLines.length) {
    const summaryText = summaryLines.join(" \n ");
    entities.push({
      entityType: "summary",
      label: "Summary",
      confidence: 0.6,
      source: "parser",
      metadata: {
        rawText: summaryText,
        parserVersion
      },
      embedding: computeEmbedding(summaryText),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const educationLines = sections.get("education") ?? [];
  for (const line of educationLines) {
    const [institution, ...rest] = line.split(/[-–]| at /i).map((value) => value.trim()).filter(Boolean);
    const label = institution || line;
    const details = rest.join(" - ") || line;
    entities.push({
      entityType: "education",
      label,
      confidence: institution ? 0.85 : 0.7,
      source: "parser",
      metadata: {
        rawText: line,
        details,
        parserVersion
      },
      embedding: computeEmbedding(line),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const experienceLines = sections.get("experience") ?? [];
  for (const line of experienceLines) {
    const [role, ...rest] = line.split(/ at | @ | - /i).map((value) => value.trim()).filter(Boolean);
    const label = role || line;
    const employer = rest.join(" - ") || undefined;
    entities.push({
      entityType: "experience",
      label,
      confidence: role ? 0.8 : 0.65,
      source: "parser",
      metadata: {
        rawText: line,
        employer,
        parserVersion
      },
      embedding: computeEmbedding(line),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const skillLines = sections.get("skill") ?? [];
  if (skillLines.length) {
    for (const skillLine of skillLines) {
      const items = skillLine
        .split(/[,•\u2022\u2023\u25E6\u2043\u2219]/)
        .map((value) => value.trim())
        .filter(Boolean);
      if (!items.length) {
        continue;
      }
      for (const item of items) {
        entities.push({
          entityType: "skill",
          label: item,
          confidence: 0.75,
          source: "parser",
          metadata: {
            rawText: skillLine,
            parserVersion
          },
          embedding: computeEmbedding(item),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
  }

  const languageLines = sections.get("language") ?? [];
  for (const line of languageLines) {
    const items = line
      .split(/[,;\u2022\u2023\u25E6]/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (!items.length) {
      entities.push({
        entityType: "language",
        label: line,
        confidence: 0.6,
        source: "parser",
        metadata: {
          rawText: line,
          parserVersion
        },
        embedding: computeEmbedding(line),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      continue;
    }

    for (const item of items) {
      entities.push({
        entityType: "language",
        label: item,
        confidence: 0.7,
        source: "parser",
        metadata: {
          rawText: line,
          parserVersion
        },
        embedding: computeEmbedding(item),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  const certificationLines = sections.get("certification") ?? [];
  for (const line of certificationLines) {
    entities.push({
      entityType: "certification",
      label: line,
      confidence: 0.7,
      source: "parser",
      metadata: {
        rawText: line,
        parserVersion
      },
      embedding: computeEmbedding(line),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  return entities;
}

function deduplicateEntities(entities: Omit<CvEntityDocument, "_id" | "cvId" | "versionId">[]) {
  const seen = new Map<string, Omit<CvEntityDocument, "_id" | "cvId" | "versionId">>();

  for (const entity of entities) {
    const key = `${entity.entityType}:${entity.label.toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing || existing.confidence < entity.confidence) {
      seen.set(key, entity);
    }
  }

  return Array.from(seen.values());
}

export async function runParseCvJob(env: AppEnv, options: ParseCvJobOptions = {}): Promise<ParseCvJobSummary> {
  const batchSize = Math.max(1, Math.min(options.batchSize ?? 10, 50));
  const parserVersion = options.parserVersion ?? "v1";
  const summary: ParseCvJobSummary = {
    processed: 0,
    parsed: 0,
    failed: 0,
    skipped: 0
  };

  const mongoClient = new MongoClient(env.MONGODB_URI);
  const s3Client = new S3Client({
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY
    }
  });

  try {
    await mongoClient.connect();
    const db = mongoClient.db();
    const versions = db.collection<CvVersionDocument>("cv_versions");
    const cvs = db.collection("cvs");
    const entitiesCollection = db.collection<CvEntityDocument>("cv_entities");

    const selector: Record<string, unknown> = options.force
      ? { parseStatus: { $ne: "processing" } }
      : { parseStatus: { $in: ["pending", "error"] } };

    const pending = await versions
      .find(selector)
      .sort({ parsedAt: 1, createdAt: 1 })
      .limit(batchSize)
      .toArray();

    if (!pending.length) {
      return summary;
    }

    for (const version of pending) {
      const claimStatuses = options.force ? ["pending", "error", "parsed"] : ["pending", "error"];
      const claim = await versions.findOneAndUpdate(
        { _id: version._id, parseStatus: { $in: claimStatuses } },
        { $set: { parseStatus: "processing", parseError: null } },
        { returnDocument: "after" }
      );

      if (!claim.value) {
        summary.skipped += 1;
        continue;
      }

      summary.processed += 1;

      await cvs.updateOne(
        { _id: version.cvId },
        {
          $set: {
            "versionHistory.$[entry].parseStatus": "processing",
            "versionHistory.$[entry].parsedAt": null
          }
        },
        { arrayFilters: [{ "entry.versionId": version._id }] }
      );

      try {
        const object = await s3Client.send(
          new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: version.objectKey })
        );

        const buffer = await bodyToBuffer(object.Body);
        const extractedText = await extractFromBuffer(version.contentType || "application/octet-stream", buffer);

        const rawEntities = extractEntities(extractedText ?? "", parserVersion);
        const deduped = deduplicateEntities(rawEntities);

        await entitiesCollection.deleteMany({ cvId: version.cvId, versionId: version._id });

        if (deduped.length) {
          const now = new Date();
          const docs = deduped.map((entity) => ({
            ...entity,
            cvId: version.cvId,
            versionId: version._id,
            createdAt: entity.createdAt ?? now,
            updatedAt: entity.updatedAt ?? now,
            source: "parser" as const
          }));
          await entitiesCollection.insertMany(docs);
        }

        const completedAt = new Date();
        await versions.updateOne(
          { _id: version._id },
          { $set: { parseStatus: "parsed", parsedAt: completedAt, parseError: null } }
        );
        await cvs.updateOne(
          { _id: version.cvId },
          {
            $set: {
              "versionHistory.$[entry].parseStatus": "parsed",
              "versionHistory.$[entry].parsedAt": completedAt
            }
          },
          { arrayFilters: [{ "entry.versionId": version._id }] }
        );

        summary.parsed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown parsing error";
        await versions.updateOne(
          { _id: version._id },
          { $set: { parseStatus: "error", parseError: message } }
        );
        await cvs.updateOne(
          { _id: version.cvId },
          {
            $set: {
              "versionHistory.$[entry].parseStatus": "error",
              "versionHistory.$[entry].parsedAt": null
            }
          },
          { arrayFilters: [{ "entry.versionId": version._id }] }
        );
        summary.failed += 1;
        // eslint-disable-next-line no-console
        console.error(
          "Failed to parse CV",
          version._id.toHexString(),
          "for cv",
          version.cvId.toHexString(),
          message,
          error
        );
      }
    }
  } finally {
    await mongoClient.close();
  }

  return summary;
}
