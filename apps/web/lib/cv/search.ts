import type { Document, ObjectId } from "mongodb";

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
}

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

export async function findCvs(
  filters: CvSearchFilters,
  options: CvSearchOptions = {}
): Promise<CvSearchResult> {
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(options.pageSize ?? 20)));

  const pipeline: Document[] = [];
  const matchStage = buildMatchStage(filters);

  if (matchStage) {
    pipeline.push({ $match: matchStage });
  }

  pipeline.push({ $sort: options.sort ?? { updatedAt: -1 } });

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
  const results = (facetResult.data as (CvDocument & { _id: ObjectId })[]).map((doc) =>
    mapDocumentToListItem(doc)
  );

  return { results, total, page, pageSize };
}

