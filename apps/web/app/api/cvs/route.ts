import { NextRequest, NextResponse } from "next/server";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getEnv } from "@/config/env";
import {
  cvsCollection,
  cvVersionsCollection,
  type CvAvailability,
  type CvConsultantInfo,
  type CvDocument,
  type CvSkill,
  type CvVersionDocument,
  type CvVersionSummary
} from "@/lib/db/cv";

const metadataSchema = z.object({
  cvId: z.string().trim().optional(),
  consultant: z.object({
    name: z.string().trim().min(1, "Consultant name is required"),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().optional(),
    title: z.string().trim().optional(),
    location: z.string().trim().optional(),
    seniority: z.string().trim().optional(),
    languages: z.array(z.string().trim()).optional()
  }),
  skills: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        level: z.string().trim().optional(),
        years: z.union([z.number(), z.string()]).optional()
      })
    )
    .optional(),
  availability: z
    .object({
      status: z.enum(["available", "unavailable", "soon", "unknown"]).optional(),
      availableFrom: z.union([z.string(), z.date()]).optional(),
      notes: z.string().optional()
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  uploadedBy: z.string().optional()
});

type MetadataInput = z.infer<typeof metadataSchema>;

interface NormalizedMetadata {
  cvId?: ObjectId;
  consultant: CvConsultantInfo;
  skills: CvSkill[];
  availability: CvAvailability;
  tags: string[];
  notes?: string | null;
  uploadedBy?: string | null;
}

type CvCollection = Awaited<ReturnType<typeof cvsCollection>>;

let cachedS3Client: S3Client | null = null;

function getS3Client() {
  if (cachedS3Client) {
    return cachedS3Client;
  }

  const env = getEnv();

  cachedS3Client = new S3Client({
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY
    }
  });

  return cachedS3Client;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .replace(/-{2,}/g, "-");
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

async function computeSha256(stream: ReadableStream<Uint8Array>) {
  const hash = createHash("sha256");
  const reader = stream.getReader();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      hash.update(value);
    }
  }

  return hash.digest("hex");
}

function normalizeYears(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeMetadata(input: MetadataInput): NormalizedMetadata {
  const consultant: CvConsultantInfo = {
    name: input.consultant.name.trim(),
    email: input.consultant.email ? input.consultant.email.trim() : null,
    phone: input.consultant.phone ? input.consultant.phone.trim() : null,
    title: input.consultant.title ? input.consultant.title.trim() : null,
    location: input.consultant.location ? input.consultant.location.trim() : null,
    seniority: input.consultant.seniority ? input.consultant.seniority.trim() : null,
    languages: (input.consultant.languages ?? [])
      .map((language) => language.trim())
      .filter((language) => Boolean(language))
  };

  const skills: CvSkill[] = (input.skills ?? []).map((skill) => ({
    name: skill.name.trim(),
    level: skill.level ? skill.level.trim() : null,
    years: normalizeYears(skill.years)
  }));

  const availabilityInput = input.availability ?? {};
  let availableFrom: Date | null = null;
  const providedAvailableFrom = availabilityInput.availableFrom;

  if (providedAvailableFrom) {
    if (providedAvailableFrom instanceof Date) {
      availableFrom = providedAvailableFrom;
    } else {
      const parsed = new Date(providedAvailableFrom);
      if (!Number.isNaN(parsed.getTime())) {
        availableFrom = parsed;
      }
    }
  }

  const availability: CvAvailability = {
    status: availabilityInput.status ?? "unknown",
    availableFrom,
    notes: availabilityInput.notes ? availabilityInput.notes.trim() : null
  };

  const tags = (input.tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => Boolean(tag));

  const notes = input.notes ? input.notes.trim() : null;
  const uploadedBy = input.uploadedBy ? input.uploadedBy.trim() : null;

  const normalized: NormalizedMetadata = {
    consultant,
    skills,
    availability,
    tags,
    notes,
    uploadedBy
  };

  if (input.cvId) {
    try {
      normalized.cvId = new ObjectId(input.cvId);
    } catch (error) {
      throw new Error("Invalid cvId provided");
    }
  }

  return normalized;
}

interface UploadResult {
  fileName: string;
  status: "stored" | "duplicate" | "error";
  versionId?: ObjectId;
  message?: string;
}

async function ensureCvDocument(metadata: NormalizedMetadata, collection?: CvCollection) {
  const cvs = collection ?? (await cvsCollection());
  const now = new Date();

  if (metadata.cvId) {
    const existing = await cvs.findOne({ _id: metadata.cvId });
    if (existing) {
      return existing;
    }
  }

  if (metadata.consultant.email) {
    const byEmail = await cvs.findOne({ "consultant.email": metadata.consultant.email });
    if (byEmail) {
      return byEmail;
    }
  }

  const newDoc: CvDocument = {
    consultant: metadata.consultant,
    skills: metadata.skills,
    availability: metadata.availability,
    tags: metadata.tags,
    notes: metadata.notes ?? null,
    versionHistory: [],
    createdAt: now,
    updatedAt: now
  };

  const insertResult = await cvs.insertOne(newDoc);
  return { ...newDoc, _id: insertResult.insertedId };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const metadataRaw = formData.get("metadata");

    if (typeof metadataRaw !== "string") {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    let parsedMetadata: MetadataInput;

    try {
      parsedMetadata = metadataSchema.parse(JSON.parse(metadataRaw));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.flatten() }, { status: 400 });
      }

      return NextResponse.json({ error: "Invalid metadata payload" }, { status: 400 });
    }

    let metadata: NormalizedMetadata;

    try {
      metadata = normalizeMetadata(parsedMetadata);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to process metadata";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const files = formData.getAll("files").filter((file): file is File => file instanceof File);

    if (files.length === 0) {
      const singleFile = formData.get("file");
      if (singleFile instanceof File) {
        files.push(singleFile);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "At least one CV file is required" }, { status: 400 });
    }

    const s3Client = getS3Client();
    const env = getEnv();
    const versions = await cvVersionsCollection();
    const cvs = await cvsCollection();

    let cvDocument: CvDocument | null = null;
    const results: UploadResult[] = [];

    for (const file of files) {
      try {
        const [hashStream, uploadStream] = file.stream().tee();
        const checksum = await computeSha256(hashStream);

        const duplicate = await versions.findOne({ checksum });
        if (duplicate) {
          results.push({
            fileName: file.name,
            status: "duplicate",
            message: "This CV has already been uploaded"
          });
          continue;
        }

        if (!cvDocument) {
          cvDocument = await ensureCvDocument(metadata, cvs);
        }

        const consultantSlug = slugify(metadata.consultant.name || "consultant");
        const sanitizedFileName = sanitizeFilename(file.name || "cv.pdf");
        const objectKey = `cvs/${consultantSlug}/${Date.now()}-${sanitizedFileName}`;

        const nodeStream = Readable.fromWeb(uploadStream as ReadableStream<Uint8Array>);

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: env.S3_BUCKET,
            Key: objectKey,
            Body: nodeStream,
            ContentType: file.type || "application/octet-stream",
            Metadata: {
              consultant: metadata.consultant.name,
              checksum
            }
          }
        });

        await upload.done();

        const now = new Date();

        const versionDoc: CvVersionDocument = {
          cvId: cvDocument._id!,
          objectKey,
          checksum,
          size: file.size,
          contentType: file.type || "application/octet-stream",
          originalFilename: file.name,
          metadata: {
            tags: metadata.tags,
            notes: metadata.notes ?? null
          },
          virusScanStatus: "pending",
          createdAt: now,
          createdBy: metadata.uploadedBy ?? null
        };

        const insertResult = await versions.insertOne(versionDoc);
        const versionId = insertResult.insertedId as ObjectId;

        const versionSummary: CvVersionSummary = {
          versionId,
          objectKey,
          checksum,
          createdAt: now,
          size: file.size,
          contentType: file.type || "application/octet-stream",
          uploadedBy: metadata.uploadedBy ?? null,
          virusScanStatus: "pending",
          virusScannedAt: null
        };

        await cvs.updateOne(
          { _id: cvDocument._id },
          {
            $set: {
              consultant: metadata.consultant,
              skills: metadata.skills,
              availability: metadata.availability,
              tags: metadata.tags,
              notes: metadata.notes ?? null,
              latestVersionId: versionId,
              updatedAt: now
            },
            $push: {
              versionHistory: versionSummary
            }
          }
        );

        results.push({
          fileName: file.name,
          status: "stored",
          versionId
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to upload CV";
        results.push({
          fileName: file.name,
          status: "error",
          message
        });
      }
    }

    const hasStored = results.some((result) => result.status === "stored");
    const allDuplicates = results.length > 0 && results.every((result) => result.status === "duplicate");
    const allErrors = results.length > 0 && results.every((result) => result.status === "error");

    if (!cvDocument && allDuplicates) {
      return NextResponse.json(
        {
          error: "All uploaded files were duplicates",
          results
        },
        { status: 409 }
      );
    }

    if (allErrors) {
      return NextResponse.json(
        {
          error: "Failed to upload any CVs",
          results
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      cvId: cvDocument?._id ?? null,
      results,
      hasStored
    });
  } catch (error) {
    console.error("CV upload failed", error);
    return NextResponse.json({ error: "Failed to upload CV" }, { status: 500 });
  }
}

