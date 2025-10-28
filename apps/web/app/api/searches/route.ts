import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { auth } from "@/lib/auth/nextauth";
import { createSavedSearch, getSavedSearchesForUser, savedSearchInputSchema } from "@/lib/saved-searches";

function serializeSavedSearch(document: Awaited<ReturnType<typeof createSavedSearch>>) {
  return {
    id: document._id?.toHexString() ?? "",
    name: document.name,
    description: document.description ?? null,
    filters: document.filters,
    notifications: document.notifications,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    lastRunAt: document.lastRunAt ? document.lastRunAt.toISOString() : null,
    lastNotifiedAt: document.lastNotifiedAt ? document.lastNotifiedAt.toISOString() : null
  };
}

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

export async function GET() {
  const session = await auth();
  const userId = getUserObjectId(session);

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searches = await getSavedSearchesForUser(userId);

  return NextResponse.json({
    items: searches.map((search) => ({
      id: search._id?.toHexString() ?? "",
      name: search.name,
      description: search.description ?? null,
      filters: search.filters,
      notifications: search.notifications,
      createdAt: search.createdAt.toISOString(),
      updatedAt: search.updatedAt.toISOString(),
      lastRunAt: search.lastRunAt ? search.lastRunAt.toISOString() : null,
      lastNotifiedAt: search.lastNotifiedAt ? search.lastNotifiedAt.toISOString() : null
    }))
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = getUserObjectId(session);

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const saved = await createSavedSearch(userId, parsed.data, { runImmediately: true });
    return NextResponse.json(serializeSavedSearch(saved), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create saved search";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

