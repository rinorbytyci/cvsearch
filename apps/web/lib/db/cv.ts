import type { Document, ObjectId } from "mongodb";
import { getDatabase } from "./client";

export type VirusScanStatus = "pending" | "queued" | "scanning" | "clean" | "infected" | "error";

export interface CvSkill {
  name: string;
  level?: string | null;
  years?: number | null;
}

export interface CvConsultantInfo {
  name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  location?: string | null;
  seniority?: string | null;
  languages?: string[];
}

export interface CvAvailability {
  status: "available" | "unavailable" | "soon" | "unknown";
  availableFrom?: Date | null;
  notes?: string | null;
}

export interface CvVersionSummary {
  versionId: ObjectId;
  objectKey: string;
  checksum: string;
  createdAt: Date;
  size: number;
  contentType: string;
  uploadedBy?: string | ObjectId | null;
  virusScanStatus: VirusScanStatus;
  virusScannedAt?: Date | null;
}

export interface CvDocument extends Document {
  _id?: ObjectId;
  consultant: CvConsultantInfo;
  skills: CvSkill[];
  availability: CvAvailability;
  tags?: string[];
  notes?: string | null;
  latestVersionId?: ObjectId;
  versionHistory: CvVersionSummary[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CvVersionMetadata {
  tags?: string[];
  notes?: string | null;
}

export interface CvVersionDocument extends Document {
  _id?: ObjectId;
  cvId: ObjectId;
  objectKey: string;
  checksum: string;
  size: number;
  contentType: string;
  originalFilename: string;
  metadata: CvVersionMetadata;
  virusScanStatus: VirusScanStatus;
  virusQueuedAt?: Date;
  virusScannedAt?: Date;
  virusScanResultMessage?: string;
  createdAt: Date;
  createdBy?: string | ObjectId | null;
  restoredFromVersionId?: ObjectId;
}

export async function cvsCollection() {
  const db = await getDatabase();
  return db.collection<CvDocument>("cvs");
}

export async function cvVersionsCollection() {
  const db = await getDatabase();
  return db.collection<CvVersionDocument>("cv_versions");
}
