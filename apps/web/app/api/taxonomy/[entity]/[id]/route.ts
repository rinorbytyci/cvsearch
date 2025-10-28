import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { auth } from "@/lib/auth/nextauth";
import {
  getTaxonomyCollection,
  mapTaxonomyDocument,
  normalizeTaxonomyInput,
  saveTaxonomyDocument,
  type TaxonomyEntity
} from "@/lib/taxonomy";

const entitySchema = z.enum(["skills", "industries", "technologies"]);

const payloadSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
  synonyms: z.array(z.string().trim()).optional()
});

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

function parseId(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, context: { params: { entity?: string; id?: string } }) {
  const entity = parseEntity(context.params?.entity);
  const id = parseId(context.params?.id);

  if (!entity || !id) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const collection = await getTaxonomyCollection(entity);
  const document = await collection.findOne({ _id: id });

  if (!document) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  return NextResponse.json(mapTaxonomyDocument(document));
}

export async function PUT(request: NextRequest, context: { params: { entity?: string; id?: string } }) {
  const entity = parseEntity(context.params?.entity);
  const id = parseId(context.params?.id);

  if (!entity || !id) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
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
    const updated = await saveTaxonomyDocument(entity, normalized, {
      id,
      userId: session.user.id ?? session.user.email ?? null
    });

    return NextResponse.json(mapTaxonomyDocument(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update taxonomy entry";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: { params: { entity?: string; id?: string } }) {
  const entity = parseEntity(context.params?.entity);
  const id = parseId(context.params?.id);

  if (!entity || !id) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const collection = await getTaxonomyCollection(entity);
  const deletion = await collection.deleteOne({ _id: id });

  if (deletion.deletedCount === 0) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

