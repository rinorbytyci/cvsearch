import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { findCvs, parseSearchFiltersFromParams } from "@/lib/cv/search";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filters = parseSearchFiltersFromParams(searchParams);
  const paginationInput = {
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined
  };

  const pagination = paginationSchema.safeParse(paginationInput);

  if (!pagination.success) {
    return NextResponse.json({ error: pagination.error.flatten() }, { status: 400 });
  }

  const { page, pageSize } = pagination.data;

  try {
    const result = await findCvs(filters, { page, pageSize });

    return NextResponse.json({
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      items: result.results.map((item) => ({
        id: item.id,
        consultant: {
          ...item.consultant,
          languages: item.consultant.languages ?? []
        },
        availability: {
          ...item.availability,
          availableFrom: item.availability.availableFrom
            ? item.availability.availableFrom.toISOString()
            : null
        },
        skills: item.skills,
        tags: item.tags,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      })),
      suggestions: result.suggestions
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch CVs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

