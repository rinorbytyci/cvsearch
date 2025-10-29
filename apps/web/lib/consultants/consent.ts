import { ObjectId, type PushOperator, type UpdateFilter } from "mongodb";

import {
  consultantConsentsCollection,
  type ConsultantConsentDocument,
  type ConsultantConsentHistoryEntry,
  type ConsentStatus,
  type LegalHoldInfo
} from "@/lib/db/collections";
import { cvsCollection } from "@/lib/db/cv";

export interface ConsentSummary {
  document: ConsultantConsentDocument;
}

export interface ConsentUpdateInput {
  status?: ConsentStatus;
  note?: string | null;
  languagePreference?: string | null;
  policyVersion?: string | null;
  updatedBy?: ObjectId | string | null;
  legalHold?: Partial<LegalHoldInfo> | null;
}

export function resolveConsultantObjectId(id: string | ObjectId): ObjectId {
  if (id instanceof ObjectId) {
    return id;
  }

  if (!ObjectId.isValid(id)) {
    throw new Error("Invalid consultant identifier");
  }

  return new ObjectId(id);
}

export async function getConsultantConsent(consultantId: ObjectId) {
  const collection = await consultantConsentsCollection();
  return collection.findOne({ consultantId });
}

async function createDefaultConsent(consultantId: ObjectId): Promise<ConsultantConsentDocument> {
  const now = new Date();
  const collection = await consultantConsentsCollection();
  const defaultDoc: ConsultantConsentDocument = {
    consultantId,
    status: "pending",
    note: null,
    consentedAt: null,
    revokedAt: null,
    updatedAt: now,
    updatedBy: null,
    history: [
      {
        status: "pending",
        note: null,
        updatedAt: now,
        updatedBy: null,
        policyVersion: null
      }
    ],
    legalHold: { active: false, reason: null, setAt: null, setBy: null },
    languagePreference: null,
    policyVersion: null
  };

  await collection.insertOne(defaultDoc);
  return defaultDoc;
}

export async function ensureConsultantConsent(consultantId: ObjectId) {
  const existing = await getConsultantConsent(consultantId);
  if (existing) {
    return existing;
  }

  return createDefaultConsent(consultantId);
}

function sanitizeLanguagePreference(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function shouldRecordHistory(
  previous: ConsultantConsentDocument,
  nextStatus: ConsentStatus,
  note: string | null,
  policyVersion: string | null
) {
  return (
    previous.status !== nextStatus ||
    (note ?? null) !== (previous.note ?? null) ||
    (policyVersion ?? null) !== (previous.policyVersion ?? null)
  );
}

function buildHistoryEntry(
  status: ConsentStatus,
  note: string | null,
  policyVersion: string | null,
  updatedAt: Date,
  updatedBy?: ObjectId | string | null
): ConsultantConsentHistoryEntry {
  return {
    status,
    note,
    policyVersion,
    updatedAt,
    updatedBy: updatedBy ?? null
  };
}

function mergeLegalHold(
  current: LegalHoldInfo | undefined,
  update: Partial<LegalHoldInfo> | null | undefined,
  now: Date,
  actor?: ObjectId | string | null
): LegalHoldInfo | undefined {
  if (!update) {
    return current;
  }

  const baseline: LegalHoldInfo = {
    active: false,
    reason: null,
    setAt: null,
    setBy: null,
    ...current
  };

  const next: LegalHoldInfo = {
    ...baseline,
    ...update
  };

  if (update.active !== undefined) {
    next.active = Boolean(update.active);
    next.setAt = now;
    next.setBy = actor ?? null;
  }

  if (update.reason !== undefined) {
    next.reason = update.reason ?? null;
  }

  return next;
}

export async function updateConsultantConsent(
  consultantId: ObjectId,
  input: ConsentUpdateInput
): Promise<ConsultantConsentDocument> {
  const collection = await consultantConsentsCollection();
  const consent = await ensureConsultantConsent(consultantId);
  const now = new Date();

  const nextStatus = input.status ?? consent.status;
  const nextNote = input.note !== undefined ? input.note : consent.note ?? null;
  const nextPolicyVersion =
    input.policyVersion !== undefined ? input.policyVersion : consent.policyVersion ?? null;
  const nextLanguagePreference =
    input.languagePreference !== undefined
      ? sanitizeLanguagePreference(input.languagePreference)
      : consent.languagePreference ?? null;

  const updates: Partial<ConsultantConsentDocument> = {
    status: nextStatus,
    note: nextNote,
    updatedAt: now,
    updatedBy: input.updatedBy ?? null,
    policyVersion: nextPolicyVersion,
    languagePreference: nextLanguagePreference
  };

  if (nextStatus === "granted") {
    updates.consentedAt = now;
    updates.revokedAt = null;
  } else if (nextStatus === "revoked") {
    updates.revokedAt = now;
  } else if (nextStatus === "pending") {
    updates.consentedAt = null;
    updates.revokedAt = null;
  }

  const legalHold = mergeLegalHold(consent.legalHold, input.legalHold, now, input.updatedBy);
  if (legalHold) {
    updates.legalHold = legalHold;
  }

  const updatePayload: UpdateFilter<ConsultantConsentDocument> = {
    $set: updates
  };

  if (shouldRecordHistory(consent, nextStatus, nextNote ?? null, nextPolicyVersion ?? null)) {
    const entry = buildHistoryEntry(
      nextStatus,
      nextNote ?? null,
      nextPolicyVersion ?? null,
      now,
      input.updatedBy
    );
    updatePayload.$push = {
      history: {
        $each: [entry],
        $slice: -50
      }
    } as unknown as PushOperator<ConsultantConsentDocument>;
  }

  const result = await collection.findOneAndUpdate(
    { consultantId },
    updatePayload,
    { returnDocument: "after" }
  );

  const updated = result?.value ?? (await ensureConsultantConsent(consultantId));

  if (input.languagePreference !== undefined) {
    const cvs = await cvsCollection();
    await cvs.updateOne(
      { _id: consultantId },
      {
        $set: {
          languagePreference: nextLanguagePreference,
          updatedAt: now
        }
      }
    );
  }

  return updated;
}

export async function getConsentSummary(consultantId: ObjectId): Promise<ConsentSummary> {
  const consent = await ensureConsultantConsent(consultantId);
  return { document: consent };
}
