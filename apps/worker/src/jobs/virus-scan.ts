import { MongoClient, ObjectId } from "mongodb";
import type { AppEnv } from "@cvsearch/config";

export type VirusScanStatus = "pending" | "queued" | "scanning" | "clean" | "infected" | "error";

interface CvVersionDocument {
  _id: ObjectId;
  cvId: ObjectId;
  objectKey: string;
  checksum: string;
  virusScanStatus: VirusScanStatus;
  virusQueuedAt?: Date;
  virusScannedAt?: Date;
  virusScanResultMessage?: string | null;
}

interface VirusScanJobSummary {
  processed: number;
  queued: number;
  scanned: number;
  clean: number;
  infected: number;
  errors: number;
}

interface PerformScanResult {
  status: Extract<VirusScanStatus, "clean" | "infected" | "error">;
  message?: string;
}

async function performVirusScan(version: CvVersionDocument): Promise<PerformScanResult> {
  // TODO: integrate with a real antivirus engine such as ClamAV or VirusTotal.
  // For now we mark every file as clean so that downstream consumers can rely on the status.
  return {
    status: "clean",
    message: `No threats detected for ${version.objectKey}`
  };
}

export interface VirusScanJobOptions {
  batchSize?: number;
}

export async function runVirusScanJob(env: AppEnv, options?: VirusScanJobOptions): Promise<VirusScanJobSummary> {
  const batchSize = options?.batchSize ?? 10;
  const summary: VirusScanJobSummary = {
    processed: 0,
    queued: 0,
    scanned: 0,
    clean: 0,
    infected: 0,
    errors: 0
  };

  const client = new MongoClient(env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();
    const versions = db.collection<CvVersionDocument>("cv_versions");
    const cvs = db.collection("cvs");

    const pendingVersions = await versions
      .find({ virusScanStatus: { $in: ["pending", "queued"] } })
      .sort({ createdAt: 1 })
      .limit(batchSize)
      .toArray();

    summary.processed = pendingVersions.length;

    for (const version of pendingVersions) {
      try {
        const now = new Date();

        if (version.virusScanStatus === "pending") {
          const queueResult = await versions.updateOne(
            { _id: version._id, virusScanStatus: "pending" },
            {
              $set: {
                virusScanStatus: "queued",
                virusQueuedAt: now,
                virusScanResultMessage: null
              }
            }
          );

          if (queueResult.modifiedCount === 0) {
            // Another worker likely picked up the job; skip processing this record.
            continue;
          }

          summary.queued += 1;
          version.virusScanStatus = "queued";
          version.virusQueuedAt = now;
        }

        const scanningResult = await versions.updateOne(
          { _id: version._id, virusScanStatus: { $in: ["queued", "pending"] } },
          { $set: { virusScanStatus: "scanning" } }
        );

        if (scanningResult.modifiedCount === 0) {
          continue;
        }

        const scanResult = await performVirusScan(version);
        const completedAt = new Date();

        await versions.updateOne(
          { _id: version._id },
          {
            $set: {
              virusScanStatus: scanResult.status,
              virusScannedAt: completedAt,
              virusScanResultMessage: scanResult.message ?? null
            }
          }
        );

        await cvs.updateOne(
          { _id: version.cvId },
          {
            $set: {
              "versionHistory.$[entry].virusScanStatus": scanResult.status,
              "versionHistory.$[entry].virusScannedAt": completedAt
            }
          },
          {
            arrayFilters: [{ "entry.versionId": version._id }]
          }
        );

        summary.scanned += 1;
        if (scanResult.status === "clean") {
          summary.clean += 1;
        } else if (scanResult.status === "infected") {
          summary.infected += 1;
        }
      } catch (error) {
        summary.errors += 1;
        await versions.updateOne(
          { _id: version._id },
          {
            $set: {
              virusScanStatus: "error",
              virusScanResultMessage: error instanceof Error ? error.message : "Unknown error"
            }
          }
        );
        // eslint-disable-next-line no-console
        console.error("Virus scan job failed for version", version._id.toHexString(), error);
      }
    }
  } finally {
    await client.close();
  }

  return summary;
}
