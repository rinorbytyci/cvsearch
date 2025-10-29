import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { ObjectId } from "mongodb";

import { logAuditEvent } from "@/app/api/middleware/audit";
import { getEnv } from "@/config/env";
import type { ConsultantConsentDocument } from "@/lib/db/collections";
import { ensureConsultantConsent, resolveConsultantObjectId } from "@/lib/consultants/consent";
import { auth } from "@/lib/auth/nextauth";

export type DocumentAction = "view" | "download";

export interface DocumentAccessOptions {
  action: DocumentAction;
  consultantId: string | ObjectId;
  versionId?: string | ObjectId | null;
  policyVersion?: string | null;
  requireConsent?: boolean;
}

export interface DocumentAccessContext {
  session: Session;
  consultantId: ObjectId;
  consent: ConsultantConsentDocument;
  action: DocumentAction;
  versionId?: ObjectId | string | null;
  policyVersion?: string | null;
}

interface AccessLogInput {
  context: DocumentAccessContext;
  request: NextRequest;
  success: boolean;
  message?: string;
  deniedReason?: string;
}

function resolveVersionId(versionId?: string | ObjectId | null) {
  if (!versionId) {
    return null;
  }

  if (versionId instanceof ObjectId) {
    return versionId;
  }

  if (!ObjectId.isValid(versionId)) {
    return versionId;
  }

  try {
    return new ObjectId(versionId);
  } catch {
    return versionId;
  }
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",").map((value) => value.trim()).filter(Boolean);
    if (first) {
      return first;
    }
  }
  const runtimeIp = (request as unknown as { ip?: string | null }).ip;
  return runtimeIp ?? null;
}

async function logAccess({ context, request, success, message, deniedReason }: AccessLogInput) {
  const eventType = context.action === "download" ? "document_download" : "document_view";
  const userId = context.session.user?.id;
  const email = context.session.user?.email ?? undefined;
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? null;
  const locale = request.headers.get("accept-language") ?? null;

  await logAuditEvent({
    type: eventType,
    success,
    userId,
    email,
    message,
    metadata: {
      action: context.action,
      consultantId: context.consultantId,
      versionId: context.versionId ?? undefined,
      policyVersion: context.policyVersion ?? null,
      consentStatus: context.consent.status,
      ipAddress,
      userAgent,
      locale,
      deniedReason: deniedReason ?? null,
      outcome: success ? "authorized" : deniedReason ? "denied" : "error"
    }
  });
}

export async function guardDocumentAccess(
  request: NextRequest,
  options: DocumentAccessOptions
): Promise<DocumentAccessContext | NextResponse> {
  const eventType = options.action === "download" ? "document_download" : "document_view";
  const session = await auth();

  if (!session?.user) {
    await logAuditEvent({
      type: eventType,
      success: false,
      message: "Unauthenticated access attempt",
      metadata: {
        action: options.action,
        consultantId: options.consultantId,
        versionId: options.versionId ?? undefined,
        deniedReason: "unauthenticated",
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent") ?? null,
        locale: request.headers.get("accept-language") ?? null,
        outcome: "denied"
      }
    });

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let consultantId: ObjectId;
  try {
    consultantId = resolveConsultantObjectId(options.consultantId);
  } catch (error) {
    await logAuditEvent({
      type: eventType,
      success: false,
      userId: session.user.id,
      email: session.user.email ?? undefined,
      message: "Invalid consultant identifier",
      metadata: {
        action: options.action,
        consultantId: options.consultantId,
        versionId: options.versionId ?? undefined,
        deniedReason: "invalid_consultant_id",
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent") ?? null,
        locale: request.headers.get("accept-language") ?? null,
        outcome: "error"
      }
    });

    return NextResponse.json({ error: "Invalid consultant identifier" }, { status: 400 });
  }

  const consent = await ensureConsultantConsent(consultantId);
  const env = getEnv();
  const requireConsent = options.requireConsent ?? env.CONSENT_REQUIRED;
  const policyVersion = options.policyVersion ?? consent.policyVersion ?? env.PRIVACY_POLICY_VERSION ?? null;
  const versionId = resolveVersionId(options.versionId ?? null);

  if (requireConsent && consent.status !== "granted") {
    await logAuditEvent({
      type: eventType,
      success: false,
      userId: session.user.id,
      email: session.user.email ?? undefined,
      message: "Consultant consent is required",
      metadata: {
        action: options.action,
        consultantId,
        versionId: versionId ?? undefined,
        policyVersion,
        consentStatus: consent.status,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent") ?? null,
        locale: request.headers.get("accept-language") ?? null,
        deniedReason: "consent_not_granted",
        outcome: "denied"
      }
    });

    return NextResponse.json({ error: "Consultant consent required" }, { status: 451 });
  }

  return {
    session,
    consultantId,
    consent,
    action: options.action,
    versionId,
    policyVersion
  };
}

export async function finalizeDocumentAccess(
  request: NextRequest,
  context: DocumentAccessContext,
  response: Response
) {
  await logAccess({
    context,
    request,
    success: response.ok,
    message: response.ok ? undefined : `Response returned status ${response.status}`,
    deniedReason: response.ok ? undefined : undefined
  });
}

export async function recordDocumentAccessFailure(
  request: NextRequest,
  context: DocumentAccessContext,
  error: unknown
) {
  const message = error instanceof Error ? error.message : "Unknown error";
  await logAccess({
    context,
    request,
    success: false,
    message,
    deniedReason: "internal_error"
  });
}
