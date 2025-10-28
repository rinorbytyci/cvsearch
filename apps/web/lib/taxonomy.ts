import { ObjectId, type Collection, type WithId } from "mongodb";

import {
  industriesCollection,
  skillsCollection,
  technologiesCollection,
  type TaxonomyDocument
} from "@/lib/db/collections";

export type TaxonomyEntity = "skills" | "industries" | "technologies";

export interface TaxonomyInput {
  name: string;
  description?: string | null;
  synonyms?: string[];
}

export interface TaxonomyResponse {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  synonyms: string[];
  createdAt: string;
  updatedAt: string;
}

function normalizeSynonyms(values?: string[] | null) {
  return (values ?? [])
    .map((value) => value.trim())
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
}

export function slugifyTaxonomyValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .replace(/-{2,}/g, "-");
}

export async function getTaxonomyCollection(entity: TaxonomyEntity): Promise<Collection<TaxonomyDocument>> {
  switch (entity) {
    case "skills":
      return skillsCollection();
    case "industries":
      return industriesCollection();
    case "technologies":
      return technologiesCollection();
    default:
      throw new Error(`Unsupported taxonomy entity: ${entity satisfies never}`);
  }
}

export function mapTaxonomyDocument(document: WithId<TaxonomyDocument>): TaxonomyResponse {
  return {
    id: document._id.toHexString(),
    slug: document.slug,
    name: document.name,
    description: document.description ?? null,
    synonyms: document.synonyms ?? [],
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString()
  };
}

export async function ensureUniqueSlug(
  entity: TaxonomyEntity,
  slug: string,
  excludeId?: ObjectId
): Promise<boolean> {
  const collection = await getTaxonomyCollection(entity);
  const existing = await collection.findOne({
    slug,
    ...(excludeId ? { _id: { $ne: excludeId } } : {})
  });
  return !existing;
}

export async function saveTaxonomyDocument(
  entity: TaxonomyEntity,
  input: TaxonomyInput,
  options?: { id?: ObjectId; userId?: ObjectId | string | null }
) {
  const collection = await getTaxonomyCollection(entity);
  const now = new Date();
  const name = input.name.trim();
  const slug = slugifyTaxonomyValue(name);
  const synonyms = normalizeSynonyms(input.synonyms ?? []);

  if (!(await ensureUniqueSlug(entity, slug, options?.id))) {
    throw new Error(`A ${entity.slice(0, -1)} with that name already exists.`);
  }

  if (options?.id) {
    const updateResult = await collection.findOneAndUpdate(
      { _id: options.id },
      {
        $set: {
          name,
          slug,
          description: input.description ?? null,
          synonyms,
          updatedAt: now,
          updatedBy: options.userId ?? null
        }
      },
      { returnDocument: "after" }
    );

    if (!updateResult) {
      throw new Error("Taxonomy document not found");
    }

    return updateResult;
  }

  const insertResult = await collection.insertOne({
    name,
    slug,
    description: input.description ?? null,
    synonyms,
    createdAt: now,
    updatedAt: now,
    createdBy: options?.userId ?? null,
    updatedBy: options?.userId ?? null
  });

  const created = await collection.findOne({ _id: insertResult.insertedId });

  if (!created) {
    throw new Error("Failed to create taxonomy document");
  }

  return created;
}

export function normalizeTaxonomyInput(input: TaxonomyInput): TaxonomyInput {
  return {
    name: input.name.trim(),
    description: input.description?.trim() ?? null,
    synonyms: normalizeSynonyms(input.synonyms)
  };
}

