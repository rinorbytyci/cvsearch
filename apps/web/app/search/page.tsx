import { Suspense } from "react";

import { SearchClient } from "./SearchClient";
import { findCvs, parseSearchFiltersFromParams } from "@/lib/cv/search";

interface PageProps {
  searchParams?: Record<string, string | string[]>;
}

function toUrlSearchParams(searchParams?: Record<string, string | string[]>) {
  const params = new URLSearchParams();
  if (!searchParams) {
    return params;
  }

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    } else if (typeof value === "string") {
      params.append(key, value);
    }
  }

  return params;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = toUrlSearchParams(searchParams);
  const filters = parseSearchFiltersFromParams(params);
  const pageParam = Number.parseInt(params.get("page") ?? "1", 10);
  const page = Number.isNaN(pageParam) ? 1 : pageParam;
  const pageSizeParam = Number.parseInt(params.get("pageSize") ?? "20", 10);
  const pageSize = Number.isNaN(pageSizeParam) ? 20 : pageSizeParam;

  const result = await findCvs(filters, { page, pageSize });

  return (
    <Suspense fallback={<p>Loading search...</p>}>
      <SearchClient
        initialFilters={{
          keyword: filters.keyword ?? "",
          skills: filters.skills ?? [],
          roles: filters.roles ?? [],
          education: filters.education ?? [],
          certifications: filters.certifications ?? [],
          languages: filters.languages ?? [],
          locations: filters.locations ?? [],
          technologies: filters.technologies ?? [],
          industries: filters.industries ?? [],
          semanticEnabled: filters.semantic?.enabled ?? true,
          similarityThreshold: filters.semantic?.similarityThreshold ?? 0.6
        }}
        initialResults={result.results.map((item) => ({
          id: item.id,
          consultant: {
            ...item.consultant,
            languages: item.consultant.languages ?? []
          },
          availability: {
            status: item.availability.status,
            availableFrom: item.availability.availableFrom
              ? item.availability.availableFrom.toISOString()
              : null,
            notes: item.availability.notes ?? null
          },
          skills: item.skills,
          tags: item.tags,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString()
        }))}
        initialSuggestions={result.suggestions}
        initialTotal={result.total}
        initialPage={result.page}
        initialPageSize={result.pageSize}
      />
    </Suspense>
  );
}
