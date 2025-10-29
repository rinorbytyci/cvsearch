import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authorize } from "@/lib/auth/authorize";
import {
  getConsentSummary,
  resolveConsultantObjectId,
  updateConsultantConsent
} from "@/lib/consultants/consent";

const updateSchema = z.object({
  status: z.enum(["pending", "granted", "revoked"]).optional(),
  note: z.string().optional().nullable(),
  languagePreference: z.string().optional().nullable(),
  policyVersion: z.string().optional().nullable(),
  legalHold: z
    .object({
      active: z.boolean().optional(),
      reason: z.string().optional().nullable()
    })
    .optional()
    .nullable()
});

function mapSummary(summary: Awaited<ReturnType<typeof getConsentSummary>>) {
  const { document } = summary;
  return {
    status: document.status,
    note: document.note ?? null,
    languagePreference: document.languagePreference ?? null,
    policyVersion: document.policyVersion ?? null,
    consentedAt: document.consentedAt ? document.consentedAt.toISOString() : null,
    revokedAt: document.revokedAt ? document.revokedAt.toISOString() : null,
    updatedAt: document.updatedAt.toISOString(),
    updatedBy: document.updatedBy ?? null,
    legalHold: document.legalHold
      ? {
          active: document.legalHold.active,
          reason: document.legalHold.reason ?? null,
          setAt: document.legalHold.setAt ? document.legalHold.setAt.toISOString() : null,
          setBy: document.legalHold.setBy ?? null
        }
      : {
          active: false,
          reason: null,
          setAt: null,
          setBy: null
        },
    history: document.history.map((entry) => ({
      status: entry.status,
      note: entry.note ?? null,
      policyVersion: entry.policyVersion ?? null,
      updatedAt: entry.updatedAt.toISOString(),
      updatedBy: entry.updatedBy ?? null
    }))
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  let consultantId;
  try {
    consultantId = resolveConsultantObjectId(params.id);
  } catch {
    return NextResponse.json({ error: "Invalid consultant identifier" }, { status: 400 });
  }

  const result = await authorize({ roles: ["admin", "consultant"] }, async () => {
    const summary = await getConsentSummary(consultantId);
    return NextResponse.json(mapSummary(summary));
  });

  if (result instanceof Response) {
    return result;
  }

  return NextResponse.json(result);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  let consultantId;
  try {
    consultantId = resolveConsultantObjectId(params.id);
  } catch {
    return NextResponse.json({ error: "Invalid consultant identifier" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await authorize({ roles: ["admin", "consultant"] }, async (session) => {
    const updated = await updateConsultantConsent(consultantId, {
      status: parsed.data.status,
      note: parsed.data.note ?? null,
      policyVersion: parsed.data.policyVersion ?? null,
      languagePreference: parsed.data.languagePreference ?? null,
      legalHold: parsed.data.legalHold ?? undefined,
      updatedBy: session.user?.id ?? null
    });

    return NextResponse.json(
      mapSummary({
        document: updated
      })
    );
  });

  if (result instanceof Response) {
    return result;
  }

  return NextResponse.json(result);
}
