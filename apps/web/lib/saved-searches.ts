import { ObjectId } from "mongodb";
import { z } from "zod";

import {
  savedSearchesCollection,
  type SavedSearchDocument,
  type SavedSearchFilters,
  type SavedSearchNotificationSettings
} from "@/lib/db/collections";
import { findCvs, type CvListItem } from "@/lib/cv/search";
import { deliverSavedSearchNotifications } from "@/lib/notifications/saved-search";

const stringArraySchema = z.array(z.string().trim()).optional();

const savedSearchFiltersSchema = z.object({
  skills: stringArraySchema,
  industries: stringArraySchema,
  technologies: stringArraySchema,
  seniority: stringArraySchema,
  availability: stringArraySchema,
  languages: stringArraySchema,
  locations: stringArraySchema
});

const savedSearchNotificationsSchema = z.object({
  email: z
    .object({
      enabled: z.boolean().default(false),
      recipients: z.array(z.string().trim().email()).optional()
    })
    .default({ enabled: false }),
  webhook: z
    .object({
      enabled: z.boolean().default(false),
      url: z.string().trim().url().optional(),
      secret: z.string().trim().optional()
    })
    .default({ enabled: false })
});

export const savedSearchInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
  filters: savedSearchFiltersSchema.default({}),
  notifications: savedSearchNotificationsSchema.default({
    email: { enabled: false },
    webhook: { enabled: false }
  })
});

function normalizeStringArray(values?: string[] | null): string[] {
  return (values ?? [])
    .flatMap((value) =>
      value
        .split(",")
        .map((segment) => segment.trim())
        .filter(Boolean)
    )
    .filter((value, index, array) => array.indexOf(value) === index);
}

export function normalizeSavedSearchFilters(filters: SavedSearchFilters): SavedSearchFilters {
  return {
    skills: normalizeStringArray(filters.skills),
    industries: normalizeStringArray(filters.industries),
    technologies: normalizeStringArray(filters.technologies),
    seniority: normalizeStringArray(filters.seniority),
    availability: normalizeStringArray(filters.availability),
    languages: normalizeStringArray(filters.languages),
    locations: normalizeStringArray(filters.locations)
  };
}

export function normalizeSavedSearchNotifications(
  settings: SavedSearchNotificationSettings
): SavedSearchNotificationSettings {
  const emailEnabled = settings.email?.enabled ?? false;
  const webhookEnabled = settings.webhook?.enabled ?? false;

  return {
    email: {
      enabled: emailEnabled,
      recipients: emailEnabled
        ? normalizeStringArray(settings.email?.recipients ?? [])
        : []
    },
    webhook: {
      enabled: webhookEnabled,
      url: webhookEnabled ? settings.webhook?.url ?? null : null,
      secret: webhookEnabled ? settings.webhook?.secret ?? null : null
    }
  };
}

export async function getSavedSearchesForUser(userId: ObjectId) {
  const collection = await savedSearchesCollection();
  return collection
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getSavedSearchById(userId: ObjectId, searchId: ObjectId) {
  const collection = await savedSearchesCollection();
  return collection.findOne({ _id: searchId, userId });
}

export interface SaveSavedSearchOptions {
  runImmediately?: boolean;
}

export async function createSavedSearch(
  userId: ObjectId,
  input: z.infer<typeof savedSearchInputSchema>,
  options: SaveSavedSearchOptions = {}
) {
  const collection = await savedSearchesCollection();
  const now = new Date();
  const filters = normalizeSavedSearchFilters(input.filters ?? {});
  const notifications = normalizeSavedSearchNotifications(input.notifications ?? {});

  const document: SavedSearchDocument = {
    userId,
    name: input.name.trim(),
    description: input.description?.trim() ?? null,
    filters,
    notifications,
    createdAt: now,
    updatedAt: now,
    lastRunAt: null,
    lastNotifiedAt: null,
    lastNotifiedCvIds: []
  };

  const insertResult = await collection.insertOne(document);
  const saved = await collection.findOne({ _id: insertResult.insertedId });

  if (!saved) {
    throw new Error("Failed to create saved search");
  }

  if (options.runImmediately) {
    await runSavedSearch(saved);
  }

  return saved;
}

export async function updateSavedSearch(
  userId: ObjectId,
  searchId: ObjectId,
  input: z.infer<typeof savedSearchInputSchema>,
  options: SaveSavedSearchOptions = {}
) {
  const collection = await savedSearchesCollection();
  const now = new Date();
  const filters = normalizeSavedSearchFilters(input.filters ?? {});
  const notifications = normalizeSavedSearchNotifications(input.notifications ?? {});

  const updateResult = await collection.findOneAndUpdate(
    { _id: searchId, userId },
    {
      $set: {
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        filters,
        notifications,
        updatedAt: now
      }
    },
    { returnDocument: "after" }
  );

  if (!updateResult) {
    throw new Error("Saved search not found");
  }

  if (options.runImmediately) {
    await runSavedSearch(updateResult);
  }

  return updateResult;
}

export async function deleteSavedSearch(userId: ObjectId, searchId: ObjectId) {
  const collection = await savedSearchesCollection();
  const result = await collection.deleteOne({ _id: searchId, userId });
  return result.deletedCount > 0;
}

export interface RunSavedSearchResult {
  matches: CvListItem[];
  notificationResults: Awaited<ReturnType<typeof deliverSavedSearchNotifications>>;
}

export async function runSavedSearch(savedSearch: SavedSearchDocument): Promise<RunSavedSearchResult> {
  const { results } = await findCvs(savedSearch.filters, { page: 1, pageSize: 50 });

  const notificationResults = await deliverSavedSearchNotifications(savedSearch, results);

  const collection = await savedSearchesCollection();
  await collection.updateOne(
    { _id: savedSearch._id },
    {
      $set: {
        lastRunAt: new Date(),
        lastNotifiedAt: new Date(),
        lastNotifiedCvIds: results.map((match) => match.objectId)
      }
    }
  );

  return { matches: results, notificationResults };
}

