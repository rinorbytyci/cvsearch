import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/nextauth";
import { parseSearchFiltersFromParams } from "@/lib/cv/search";
import { createCsv, collectCvRows } from "@/lib/export/cv";
import { logExportEvent } from "@/lib/export/log";
import { checkRateLimit } from "@/lib/rate-limit";

const EXPORT_RATE_LIMIT = { limit: 5, intervalMs: 15 * 60 * 1000 } as const;

export async function GET(request: NextRequest) {
  const session = await auth();
  const searchParams = request.nextUrl.searchParams;
  const filters = parseSearchFiltersFromParams(searchParams);

  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    request.ip ??
    null;
  const rateKey = userId ? `user:${userId}` : `ip:${ipAddress ?? "unknown"}`;

  const rateResult = checkRateLimit(rateKey, EXPORT_RATE_LIMIT);

  if (!rateResult.allowed) {
    return NextResponse.json(
      {
        error: "Export rate limit exceeded",
        retryAfter: new Date(rateResult.resetAt).toISOString()
      },
      { status: 429 }
    );
  }

  try {
    const { rows, total } = await collectCvRows(filters);
    const csv = createCsv(rows);

    await logExportEvent({
      userId,
      email,
      format: "csv",
      filters,
      count: rows.length,
      ipAddress
    });

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="cv-export-${Date.now()}.csv"`,
        "x-total-count": total.toString()
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export CVs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

