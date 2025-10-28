import { ObjectId } from "mongodb";

import { exportLogsCollection, type SavedSearchFilters } from "@/lib/db/collections";

export interface ExportLogInput {
  userId?: string | null;
  email?: string | null;
  format: "csv" | "excel";
  filters: SavedSearchFilters;
  count: number;
  ipAddress?: string | null;
}

export async function logExportEvent(input: ExportLogInput) {
  const collection = await exportLogsCollection();
  const now = new Date();
  let userObjectId: ObjectId | null = null;

  if (input.userId) {
    try {
      userObjectId = new ObjectId(input.userId);
    } catch {
      userObjectId = null;
    }
  }

  await collection.insertOne({
    userId: userObjectId,
    email: input.email ?? null,
    format: input.format,
    filters: input.filters,
    count: input.count,
    createdAt: now,
    ipAddress: input.ipAddress ?? null
  });
}

