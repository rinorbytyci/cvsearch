import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/nextauth";
import { parseSearchFiltersFromParams } from "@/lib/cv/search";
import { collectCvRows, createExcelBuffer } from "@/lib/export/cv";
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
    const buffer = await createExcelBuffer(rows);

    await logExportEvent({
      userId,
      email,
      format: "excel",
      filters,
      count: rows.length,
      ipAddress
    });

    return new NextResponse(buffer, {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="cv-export-${Date.now()}.xlsx"`,
        "x-total-count": total.toString()
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export CVs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

