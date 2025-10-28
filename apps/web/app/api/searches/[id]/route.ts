import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { auth } from "@/lib/auth/nextauth";
import {
  deleteSavedSearch,
  getSavedSearchById,
  savedSearchInputSchema,
  updateSavedSearch
} from "@/lib/saved-searches";

function getUserObjectId(session: Awaited<ReturnType<typeof auth>>) {
  const id = session?.user?.id;

  if (!id) {
    return null;
  }

  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function parseSearchId(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

function serializeSavedSearch(search: Awaited<ReturnType<typeof getSavedSearchById>>) {
  if (!search) {
    return null;
  }

  return {
    id: search._id?.toHexString() ?? "",
    name: search.name,
    description: search.description ?? null,
    filters: search.filters,
    notifications: search.notifications,
    createdAt: search.createdAt.toISOString(),
    updatedAt: search.updatedAt.toISOString(),
    lastRunAt: search.lastRunAt ? search.lastRunAt.toISOString() : null,
    lastNotifiedAt: search.lastNotifiedAt ? search.lastNotifiedAt.toISOString() : null
  };
}

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const session = await auth();
  const userId = getUserObjectId(session);
  const searchId = parseSearchId(context.params?.id);

  if (!session?.user || !userId || !searchId) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const search = await getSavedSearchById(userId, searchId);

  if (!search) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  return NextResponse.json(serializeSavedSearch(search));
}

export async function PUT(request: NextRequest, context: { params: { id?: string } }) {
  const session = await auth();
  const userId = getUserObjectId(session);
  const searchId = parseSearchId(context.params?.id);

  if (!session?.user || !userId || !searchId) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = savedSearchInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await updateSavedSearch(userId, searchId, parsed.data, { runImmediately: true });
    return NextResponse.json(serializeSavedSearch(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update saved search";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: { params: { id?: string } }) {
  const session = await auth();
  const userId = getUserObjectId(session);
  const searchId = parseSearchId(context.params?.id);

  if (!session?.user || !userId || !searchId) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const deleted = await deleteSavedSearch(userId, searchId);

  if (!deleted) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

