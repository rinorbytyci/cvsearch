import type { Document, ObjectId } from "mongodb";

import { getEnv } from "@/config/env";
import { cvEntitiesCollection, type CvEntityDocument } from "@/lib/db/cv-entities";
import { cvsCollection, type CvDocument } from "@/lib/db/cv";
import type { SavedSearchFilters } from "@/lib/db/collections";

export type CvSearchFilters = SavedSearchFilters;

export interface CvListItem {
  objectId: ObjectId;
  id: string;
  consultant: CvDocument["consultant"];
  availability: CvDocument["availability"];
  skills: CvDocument["skills"];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CvSearchOptions {
  page?: number;
  pageSize?: number;
  sort?: Document;
}

export interface CvSearchResult {
  results: CvListItem[];
  total: number;
  page: number;
  pageSize: number;
  suggestions: CvSemanticSuggestion[];
}

export interface CvSemanticSuggestion {
  type: CvEntityDocument["entityType"];
  value: string;
  score: number;
}

const EMBEDDING_DIMENSIONS = 256;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createExactMatchRegex(value: string) {
  return new RegExp(`^${escapeRegex(value)}$`, "i");
}

function normalizeFilterValues(values?: string[] | null) {
  return (values ?? [])
    .flatMap((value) =>
      value
        .split(",")
        .map((segment) => segment.trim())
        .filter(Boolean)
    )
    .filter((value, index, array) => array.indexOf(value) === index);
}

export function parseSearchFiltersFromParams(params: URLSearchParams): CvSearchFilters {
  const filters: CvSearchFilters = {};

  const keyword = params.get("q")?.trim();
  if (keyword) {
    filters.keyword = keyword;
  }

  const skills = normalizeFilterValues(params.getAll("skills"));
  if (skills.length) {
    filters.skills = skills;
  }

  const seniority = normalizeFilterValues(params.getAll("seniority"));
  if (seniority.length) {
    filters.seniority = seniority;
  }

  const availability = normalizeFilterValues(params.getAll("availability"));
  if (availability.length) {
    filters.availability = availability;
  }

  const languages = normalizeFilterValues(params.getAll("language"));
  if (languages.length) {
    filters.languages = languages;
  }

  const locations = normalizeFilterValues(params.getAll("location"));
  if (locations.length) {
    filters.locations = locations;
  }

  const technologies = normalizeFilterValues(params.getAll("technology"));
  if (technologies.length) {
    filters.technologies = technologies;
  }

  const industries = normalizeFilterValues(params.getAll("industry"));
  if (industries.length) {
    filters.industries = industries;
  }

  const roles = normalizeFilterValues(params.getAll("role"));
  if (roles.length) {
    filters.roles = roles;
  }

  const education = normalizeFilterValues(params.getAll("education"));
  if (education.length) {
    filters.education = education;
  }

  const certifications = normalizeFilterValues(params.getAll("certification"));
  if (certifications.length) {
    filters.certifications = certifications;
  }

  const semanticFlag = params.get("semantic");
  const similarityThreshold = params.get("semanticThreshold");
  if (semanticFlag || similarityThreshold) {
    filters.semantic = {
      enabled: semanticFlag ? !["0", "false", "off"].includes(semanticFlag.toLowerCase()) : undefined,
      similarityThreshold: similarityThreshold ? Number.parseFloat(similarityThreshold) : undefined
    };
  }

  return filters;
}

function buildMatchStage(filters: CvSearchFilters) {
  const andConditions: Document[] = [];

  if (filters.skills?.length) {
    for (const skill of filters.skills) {
      andConditions.push({
        skills: {
          $elemMatch: {
            name: createExactMatchRegex(skill)
          }
        }
      });
    }
  }

  if (filters.seniority?.length) {
    andConditions.push({
      "consultant.seniority": {
        $in: filters.seniority.map((value) => createExactMatchRegex(value))
      }
    });
  }

  if (filters.availability?.length) {
    andConditions.push({
      "availability.status": {
        $in: filters.availability
      }
    });
  }

  if (filters.languages?.length) {
    andConditions.push({
      "consultant.languages": {
        $all: filters.languages.map((value) => createExactMatchRegex(value))
      }
    });
  }

  if (filters.locations?.length) {
    andConditions.push({
      "consultant.location": {
        $in: filters.locations.map((value) => createExactMatchRegex(value))
      }
    });
  }

  if (filters.technologies?.length) {
    andConditions.push({
      tags: {
        $all: filters.technologies.map((value) => createExactMatchRegex(value))
      }
    });
  }

  if (filters.industries?.length) {
    andConditions.push({
      tags: {
        $all: filters.industries.map((value) => createExactMatchRegex(value))
      }
    });
  }

  if (andConditions.length === 0) {
    return null;
  }

  return { $and: andConditions } satisfies Document;
}

function mapDocumentToListItem(document: CvDocument & { _id: ObjectId }): CvListItem {
  return {
    objectId: document._id,
    id: document._id.toHexString(),
    consultant: {
      ...document.consultant,
      languages: document.consultant.languages ?? []
    },
    availability: document.availability,
    skills: document.skills ?? [],
    tags: document.tags ?? [],
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

function computeEmbedding(text: string) {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

  for (const token of tokens) {
    let hash = 0;
    for (let index = 0; index < token.length; index += 1) {
      hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
    }

    const bucket = hash % EMBEDDING_DIMENSIONS;
    vector[bucket] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || !b.length || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    magnitudeA += av * av;
    magnitudeB += bv * bv;
  }

  if (!magnitudeA || !magnitudeB) {
    return 0;
  }

  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function generateSemanticSuggestions(
  filters: CvSearchFilters,
  entities: CvEntityDocument[],
  keyword?: string | null
): CvSemanticSuggestion[] {
  if (!keyword) {
    return [];
  }

  const queryEmbedding = computeEmbedding(keyword);
  const appliedValues = new Set(
    [
      ...(filters.skills ?? []),
      ...(filters.roles ?? []),
      ...(filters.education ?? []),
      ...(filters.languages ?? []),
      ...(filters.certifications ?? []),
      ...(filters.technologies ?? []),
      ...(filters.industries ?? []),
      ...(filters.locations ?? []),
      ...(filters.keyword ? [filters.keyword] : [])
    ].map((value) => value.toLowerCase())
  );

  const threshold = filters.semantic?.similarityThreshold ?? 0.6;
  const scored = new Map<string, CvSemanticSuggestion>();

  for (const entity of entities) {
    if (!entity.embedding || entity.embedding.length !== EMBEDDING_DIMENSIONS) {
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, entity.embedding);
    if (!Number.isFinite(score) || score < threshold) {
      continue;
    }

    const key = `${entity.entityType}:${entity.label.toLowerCase()}`;
    if (appliedValues.has(entity.label.toLowerCase())) {
      continue;
    }

    const candidate: CvSemanticSuggestion = {
      type: entity.entityType,
      value: entity.label,
      score: Number(score.toFixed(4))
    };

    const existing = scored.get(key);
    if (!existing || existing.score < candidate.score) {
      scored.set(key, candidate);
    }
  }

  return Array.from(scored.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function resolveOpenSearchMatches(keyword: string) {
  const env = getEnv();
  if (!env.OPENSEARCH_HOST) {
    return null;
  }

  const url = `${env.OPENSEARCH_HOST.replace(/\/$/, "")}/cvs/_search`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.OPENSEARCH_API_KEY ? { authorization: `ApiKey ${env.OPENSEARCH_API_KEY}` } : {})
      },
      body: JSON.stringify({
        size: 50,
        query: {
          multi_match: {
            query: keyword,
            fields: ["consultant.name^3", "consultant.title", "skills", "tags", "entities"],
            fuzziness: "AUTO"
          }
        }
      })
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      hits?: { hits?: { _id?: string }[] };
    };

    const ids = payload.hits?.hits?.flatMap((hit) => {
      try {
        return hit._id ? [new ObjectId(hit._id)] : [];
      } catch {
        return [];
      }
    });

    return ids && ids.length ? ids : null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to query OpenSearch", error);
    return null;
  }
}

export async function findCvs(
  filters: CvSearchFilters,
  options: CvSearchOptions = {}
): Promise<CvSearchResult> {
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(options.pageSize ?? 20)));

  const env = getEnv();
  const pipeline: Document[] = [];

  const keyword = filters.keyword?.trim();
  const useAtlasSearch = Boolean(keyword && env.ATLAS_SEARCH_INDEX_NAME);
  const keywordRegex = keyword ? new RegExp(escapeRegex(keyword), "i") : null;

  if (useAtlasSearch && keyword) {
    pipeline.push({
      $search: {
        index: env.ATLAS_SEARCH_INDEX_NAME,
        compound: {
          should: [
            {
              text: {
                query: keyword,
                path: ["consultant.name", "consultant.title", "skills.name", "tags", "notes"]
              }
            }
          ],
          minimumShouldMatch: 1
        }
      }
    });
    pipeline.push({ $set: { searchScore: { $meta: "searchScore" } } });
  }

  const matchStage = buildMatchStage(filters);

  if (matchStage) {
    pipeline.push({ $match: matchStage });
  }

  if (!useAtlasSearch && keywordRegex) {
    pipeline.push({
      $match: {
        $or: [
          { "consultant.name": keywordRegex },
          { "consultant.title": keywordRegex },
          { "consultant.languages": keywordRegex },
          { "availability.notes": keywordRegex },
          { "skills.name": keywordRegex },
          { tags: keywordRegex },
          { notes: keywordRegex }
        ]
      }
    });
  }

  const openSearchIds = keyword ? await resolveOpenSearchMatches(keyword) : null;
  if (openSearchIds?.length) {
    pipeline.push({ $match: { _id: { $in: openSearchIds } } });
  }

  const needsEntitiesLookup = Boolean(
    filters.roles?.length ||
      filters.education?.length ||
      filters.certifications?.length ||
      (!useAtlasSearch && keywordRegex) ||
      filters.semantic?.enabled
  );

  if (needsEntitiesLookup) {
    pipeline.push({
      $lookup: {
        from: "cv_entities",
        let: { cvId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$cvId", "$$cvId"]
              }
            }
          }
        ],
        as: "parsedEntities"
      }
    });

    if (!useAtlasSearch && keywordRegex) {
      pipeline.push({
        $match: {
          $or: [
            { parsedEntities: { $elemMatch: { label: keywordRegex } } },
            { parsedEntities: { $elemMatch: { metadata: { rawText: keywordRegex } } } }
          ]
        }
      });
    }

    if (filters.roles?.length) {
      const roleRegexes = filters.roles.map((value) => createExactMatchRegex(value));
      pipeline.push({
        $match: {
          parsedEntities: {
            $elemMatch: {
              entityType: "experience",
              label: { $in: roleRegexes }
            }
          }
        }
      });
    }

    if (filters.education?.length) {
      const educationRegexes = filters.education.map((value) => createExactMatchRegex(value));
      pipeline.push({
        $match: {
          parsedEntities: {
            $elemMatch: {
              entityType: "education",
              label: { $in: educationRegexes }
            }
          }
        }
      });
    }

    if (filters.certifications?.length) {
      const certificationRegexes = filters.certifications.map((value) => createExactMatchRegex(value));
      pipeline.push({
        $match: {
          parsedEntities: {
            $elemMatch: {
              entityType: "certification",
              label: { $in: certificationRegexes }
            }
          }
        }
      });
    }
  }

  pipeline.push({ $sort: options.sort ?? { updatedAt: -1, searchScore: -1 } });

  pipeline.push({
    $facet: {
      data: [
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize },
        {
          $project: {
            consultant: 1,
            availability: 1,
            skills: 1,
            tags: 1,
            createdAt: 1,
            updatedAt: 1
          }
        }
      ],
      totalCount: [{ $count: "count" }]
    }
  });

  const collection = await cvsCollection();
  const aggregated = await collection.aggregate(pipeline).toArray();
  const facetResult = aggregated[0] ?? { data: [], totalCount: [] };

  const total = facetResult.totalCount?.[0]?.count ?? 0;
  const docs = facetResult.data as (CvDocument & { _id: ObjectId })[];
  const results = docs.map((doc) => mapDocumentToListItem(doc));

  const shouldGenerateSuggestions = Boolean(
    (filters.semantic?.enabled ?? Boolean(keyword)) && keyword && results.length
  );

  let suggestions: CvSemanticSuggestion[] = [];

  if (shouldGenerateSuggestions) {
    const ids = docs.map((doc) => doc._id);
    const entitiesCollection = await cvEntitiesCollection();
    const relatedEntities = await entitiesCollection
      .find({ cvId: { $in: ids } })
      .limit(200)
      .toArray();
    suggestions = generateSemanticSuggestions(filters, relatedEntities, keyword);
  }

  return { results, total, page, pageSize, suggestions };
}
