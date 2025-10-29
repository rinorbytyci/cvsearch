import type { Document, ObjectId } from "mongodb";
import { getDatabase } from "./client";

export interface UserDocument {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  name?: string | null;
  role: string;
  permissions: string[];
  emailVerified?: Date | null;
  totpSecret?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDocument {
  _id?: ObjectId;
  sessionToken: string;
  userId: ObjectId;
  expires: Date;
}

export interface VerificationTokenDocument extends Document {
  identifier: string;
  token: string;
  expires: Date;
}

export type AuditLogEventType =
  | "login"
  | "password_reset"
  | "session_revocation"
  | "document_view"
  | "document_download";

export interface AuditLogMetadata extends Record<string, unknown> {
  action?: string;
  consultantId?: ObjectId | string;
  versionId?: ObjectId | string;
  ipAddress?: string | null;
  policyVersion?: string | null;
  consentStatus?: string | null;
  deniedReason?: string | null;
  userAgent?: string | null;
  locale?: string | null;
  outcome?: "authorized" | "denied" | "error";
}

export interface AuditLogDocument extends Document {
  _id?: ObjectId;
  type: AuditLogEventType;
  success: boolean;
  userId?: ObjectId | string;
  email?: string;
  message?: string;
  createdAt: Date;
  metadata?: AuditLogMetadata;
}

export type ConsentStatus = "pending" | "granted" | "revoked";

export interface ConsultantConsentHistoryEntry {
  status: ConsentStatus;
  note?: string | null;
  updatedAt: Date;
  updatedBy?: ObjectId | string | null;
  policyVersion?: string | null;
}

export interface LegalHoldInfo {
  active: boolean;
  reason?: string | null;
  setAt?: Date | null;
  setBy?: ObjectId | string | null;
}

export interface ConsultantConsentDocument extends Document {
  _id?: ObjectId;
  consultantId: ObjectId;
  status: ConsentStatus;
  note?: string | null;
  consentedAt?: Date | null;
  revokedAt?: Date | null;
  updatedAt: Date;
  updatedBy?: ObjectId | string | null;
  history: ConsultantConsentHistoryEntry[];
  legalHold?: LegalHoldInfo;
  languagePreference?: string | null;
  policyVersion?: string | null;
}

export interface TaxonomyDocument extends Document {
  _id?: ObjectId;
  slug: string;
  name: string;
  description?: string | null;
  synonyms: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: ObjectId | string | null;
  updatedBy?: ObjectId | string | null;
}

export interface SavedSearchFilters {
  keyword?: string | null;
  skills?: string[];
  industries?: string[];
  technologies?: string[];
  seniority?: string[];
  availability?: string[];
  languages?: string[];
  locations?: string[];
  roles?: string[];
  education?: string[];
  certifications?: string[];
  semantic?: {
    enabled?: boolean;
    similarityThreshold?: number;
  };
}

export interface SavedSearchNotificationSettings {
  email?: {
    enabled: boolean;
    recipients?: string[] | null;
  };
  webhook?: {
    enabled: boolean;
    url?: string | null;
    secret?: string | null;
  };
}

export interface SavedSearchDocument extends Document {
  _id?: ObjectId;
  userId: ObjectId;
  name: string;
  description?: string | null;
  filters: SavedSearchFilters;
  notifications: SavedSearchNotificationSettings;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date | null;
  lastNotifiedAt?: Date | null;
  lastNotifiedCvIds?: ObjectId[];
}

export interface ExportLogDocument extends Document {
  _id?: ObjectId;
  userId?: ObjectId | null;
  email?: string | null;
  format: "csv" | "excel";
  filters: SavedSearchFilters;
  createdAt: Date;
  ipAddress?: string | null;
  count: number;
  metadata?: Record<string, unknown>;
}

export async function usersCollection() {
  const db = await getDatabase();
  return db.collection<UserDocument>("users");
}

export async function sessionsCollection() {
  const db = await getDatabase();
  return db.collection<SessionDocument>("sessions");
}

export async function verificationTokensCollection() {
  const db = await getDatabase();
  return db.collection<VerificationTokenDocument>("verificationTokens");
}

export async function auditLogsCollection() {
  const db = await getDatabase();
  return db.collection<AuditLogDocument>("audit_logs");
}

export async function consultantConsentsCollection() {
  const db = await getDatabase();
  return db.collection<ConsultantConsentDocument>("consultant_consents");
}

export async function skillsCollection() {
  const db = await getDatabase();
  return db.collection<TaxonomyDocument>("skills");
}

export async function industriesCollection() {
  const db = await getDatabase();
  return db.collection<TaxonomyDocument>("industries");
}

export async function technologiesCollection() {
  const db = await getDatabase();
  return db.collection<TaxonomyDocument>("technologies");
}

export async function savedSearchesCollection() {
  const db = await getDatabase();
  return db.collection<SavedSearchDocument>("saved_searches");
}

export async function exportLogsCollection() {
  const db = await getDatabase();
  return db.collection<ExportLogDocument>("export_logs");
}
