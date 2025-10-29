import { MongoClient, ObjectId } from "mongodb";
import type { AppEnv } from "@cvsearch/config";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type CvRetentionStatus = "active" | "flagged" | "purged";

interface CvRetentionState {
  status: CvRetentionStatus;
  flaggedAt?: Date | null;
  purgeScheduledFor?: Date | null;
  purgedAt?: Date | null;
  warningSentAt?: Date | null;
  reason?: string | null;
}

interface CvDocument {
  _id: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  retention?: CvRetentionState;
}

interface ConsultantConsentDocument {
  consultantId: ObjectId;
  legalHold?: {
    active?: boolean;
  };
}

export interface DataRetentionSummary {
  processed: number;
  flagged: number;
  purged: number;
  restored: number;
  skippedLegalHold: number;
  errors: number;
}

export interface DataRetentionJobOptions {
  now?: Date;
}

function calculatePurgeSchedule(lastUpdated: Date, purgeDays: number) {
  return new Date(lastUpdated.getTime() + purgeDays * DAY_IN_MS);
}

function createActiveState(): CvRetentionState {
  return {
    status: "active",
    flaggedAt: null,
    purgeScheduledFor: null,
    purgedAt: null,
    warningSentAt: null,
    reason: null
  };
}

export async function runDataRetentionJob(
  env: AppEnv,
  options?: DataRetentionJobOptions
): Promise<DataRetentionSummary> {
  const summary: DataRetentionSummary = {
    processed: 0,
    flagged: 0,
    purged: 0,
    restored: 0,
    skippedLegalHold: 0,
    errors: 0
  };

  const now = options?.now ?? new Date();
  const warningThreshold = new Date(now.getTime() - env.CV_RETENTION_WARNING_DAYS * DAY_IN_MS);
  const purgeThreshold = new Date(now.getTime() - env.CV_RETENTION_PURGE_DAYS * DAY_IN_MS);

  const client = new MongoClient(env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();
    const cvs = db.collection<CvDocument>("cvs");
    const consents = db.collection<ConsultantConsentDocument>("consultant_consents");

    const cursor = cvs.find({});

    // eslint-disable-next-line no-await-in-loop
    while (await cursor.hasNext()) {
      // eslint-disable-next-line no-await-in-loop
      const cv = await cursor.next();
      if (!cv?._id) {
        continue;
      }

      summary.processed += 1;

      const lastUpdated = cv.updatedAt ?? cv.createdAt;
      const consent = await consents.findOne({ consultantId: cv._id });
      const legalHoldActive = consent?.legalHold?.active ?? false;

      if (legalHoldActive) {
        summary.skippedLegalHold += 1;
        continue;
      }

      try {
        if (lastUpdated <= purgeThreshold) {
          const purgeState: CvRetentionState = {
            status: "purged",
            flaggedAt: cv.retention?.flaggedAt ?? null,
            purgeScheduledFor:
              cv.retention?.purgeScheduledFor ?? calculatePurgeSchedule(lastUpdated, env.CV_RETENTION_PURGE_DAYS),
            purgedAt: now,
            warningSentAt: cv.retention?.warningSentAt ?? null,
            reason: "retention_policy"
          };

          const result = await cvs.updateOne(
            { _id: cv._id },
            {
              $set: {
                retention: purgeState
              }
            }
          );

          if (result.modifiedCount > 0 || cv.retention?.status !== "purged") {
            summary.purged += 1;
          }

          continue;
        }

        if (lastUpdated <= warningThreshold) {
          const purgeScheduledFor = calculatePurgeSchedule(lastUpdated, env.CV_RETENTION_PURGE_DAYS);
          const shouldUpdate =
            cv.retention?.status !== "flagged" ||
            !cv.retention.flaggedAt ||
            !cv.retention.purgeScheduledFor ||
            cv.retention.purgeScheduledFor.getTime() !== purgeScheduledFor.getTime();

          if (shouldUpdate) {
            const flagState: CvRetentionState = {
              status: "flagged",
              flaggedAt: cv.retention?.flaggedAt ?? now,
              purgeScheduledFor,
              purgedAt: null,
              warningSentAt: cv.retention?.warningSentAt ?? now,
              reason: "retention_policy"
            };

            const result = await cvs.updateOne(
              { _id: cv._id },
              {
                $set: {
                  retention: flagState
                }
              }
            );

            if (result.modifiedCount > 0 || cv.retention?.status !== "flagged") {
              summary.flagged += 1;
            }
          }

          continue;
        }

        if (cv.retention && cv.retention.status !== "active") {
          const activeState = createActiveState();
          const result = await cvs.updateOne(
            { _id: cv._id },
            {
              $set: {
                retention: activeState
              }
            }
          );

          if (result.modifiedCount > 0) {
            summary.restored += 1;
          }
        }
      } catch (error) {
        summary.errors += 1;
        // eslint-disable-next-line no-console
        console.error("Data retention processing failed", cv._id.toHexString(), error);
      }
    }
  } finally {
    await client.close();
  }

  return summary;
}
