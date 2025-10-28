import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth/nextauth";
import {
  getTaxonomyCollection,
  mapTaxonomyDocument,
  normalizeTaxonomyInput,
  saveTaxonomyDocument,
  slugifyTaxonomyValue,
  type TaxonomyEntity
} from "@/lib/taxonomy";

const entitySchema = z.enum(["skills", "industries", "technologies"]);

const listQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

const payloadSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
  synonyms: z.array(z.string().trim()).optional()
});

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseEntity(value: string | undefined): TaxonomyEntity | null {
  if (!value) {
    return null;
  }

  const result = entitySchema.safeParse(value);
  if (!result.success) {
    return null;
  }

  return result.data;
}

export async function GET(request: NextRequest, context: { params: { entity?: string } }) {
  const entity = parseEntity(context.params?.entity);

  if (!entity) {
    return NextResponse.json({ error: "Unknown taxonomy entity" }, { status: 404 });
  }

  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());
  const parseResult = listQuerySchema.safeParse(queryParams);

  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const { search, page, pageSize } = parseResult.data;
  const collection = await getTaxonomyCollection(entity);
  const pipeline: Record<string, unknown>[] = [];

  if (search && search.trim().length > 0) {
    const regex = new RegExp(escapeRegex(search.trim()), "i");
    pipeline.push({
      $match: {
        $or: [
          { name: regex },
          { synonyms: { $elemMatch: { $regex: regex } } }
        ]
      }
    });
  }

  pipeline.push({ $sort: { name: 1, _id: 1 } });
  pipeline.push({
    $facet: {
      data: [
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize }
      ],
      totalCount: [{ $count: "count" }]
    }
  });

  const [result] = await collection.aggregate(pipeline).toArray();
  const total = result?.totalCount?.[0]?.count ?? 0;
  const items = (result?.data ?? []).map((doc: unknown) => mapTaxonomyDocument(doc as any));

  return NextResponse.json({
    entity,
    page,
    pageSize,
    total,
    items
  });
}

export async function POST(request: NextRequest, context: { params: { entity?: string } }) {
  const entity = parseEntity(context.params?.entity);

  if (!entity) {
    return NextResponse.json({ error: "Unknown taxonomy entity" }, { status: 404 });
  }

  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof payloadSchema>;

  try {
    payload = payloadSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Invalid taxonomy payload" }, { status: 400 });
  }

  try {
    const normalized = normalizeTaxonomyInput(payload);
    const document = await saveTaxonomyDocument(entity, normalized, {
      userId: session.user.id ?? session.user.email ?? null
    });

    return NextResponse.json(mapTaxonomyDocument(document), {
      status: 201,
      headers: {
        Location: `/api/taxonomy/${entity}/${slugifyTaxonomyValue(normalized.name)}`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create taxonomy entry";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

