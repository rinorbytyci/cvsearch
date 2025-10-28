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

export interface AuditLogDocument extends Document {
  _id?: ObjectId;
  type: "login" | "password_reset" | "session_revocation";
  success: boolean;
  userId?: ObjectId | string;
  email?: string;
  message?: string;
  createdAt: Date;
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
