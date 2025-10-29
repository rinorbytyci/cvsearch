import { ObjectId } from "mongodb";

import { auditLogsCollection } from "@/lib/db/collections";
import type { AuditLogMetadata } from "@/lib/db/collections";

export type AuditEventType =
  | "login"
  | "password_reset"
  | "session_revocation"
  | "document_view"
  | "document_download";

export interface AuditEvent {
  type: AuditEventType;
  success: boolean;
  userId?: string | ObjectId;
  email?: string;
  message?: string;
  metadata?: AuditLogMetadata;
}

function normalizeUserId(userId?: string | ObjectId) {
  if (!userId) {
    return undefined;
  }

  if (userId instanceof ObjectId) {
    return userId;
  }

  if (ObjectId.isValid(userId)) {
    try {
      return new ObjectId(userId);
    } catch {
      return userId;
    }
  }

  return userId;
}

export async function logAuditEvent(event: AuditEvent) {
  const collection = await auditLogsCollection();
  const document = {
    type: event.type,
    success: event.success,
    userId: normalizeUserId(event.userId),
    email: event.email,
    message: event.message,
    metadata: event.metadata ?? {},
    createdAt: new Date()
  };

  await collection.insertOne(document);
}
