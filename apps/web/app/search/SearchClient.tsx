"use client";

import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction
} from "react";

interface SearchResultItem {
  id: string;
  consultant: {
    name: string;
    email?: string | null;
    title?: string | null;
    location?: string | null;
    languages: string[];
  };
  availability: {
    status: string;
    availableFrom: string | null;
    notes?: string | null;
  };
  skills: { name: string; level?: string | null; years?: number | null }[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface SearchSuggestion {
  type: string;
  value: string;
  score: number;
}

interface SearchClientProps {
  initialFilters: {
    keyword: string;
    skills: string[];
    roles: string[];
    education: string[];
    certifications: string[];
    languages: string[];
    locations: string[];
    technologies: string[];
    industries: string[];
    semanticEnabled: boolean;
    similarityThreshold: number;
  };
  initialResults: SearchResultItem[];
  initialSuggestions: SearchSuggestion[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
}

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function SearchClient({
  initialFilters,
  initialResults,
  initialSuggestions,
  initialTotal,
  initialPage,
  initialPageSize
}: SearchClientProps) {
  const [keyword, setKeyword] = useState(initialFilters.keyword);

  const [skillsText, setSkillsText] = useState(initialFilters.skills.join(", "));
  const [skills, setSkills] = useState(initialFilters.skills);

  const [rolesText, setRolesText] = useState(initialFilters.roles.join(", "));
  const [roles, setRoles] = useState(initialFilters.roles);

  const [educationText, setEducationText] = useState(initialFilters.education.join(", "));
  const [education, setEducation] = useState(initialFilters.education);

  const [certificationsText, setCertificationsText] = useState(initialFilters.certifications.join(", "));
  const [certifications, setCertifications] = useState(initialFilters.certifications);

  const [languagesText, setLanguagesText] = useState(initialFilters.languages.join(", "));
  const [languages, setLanguages] = useState(initialFilters.languages);

  const [locationsText, setLocationsText] = useState(initialFilters.locations.join(", "));
  const [locations, setLocations] = useState(initialFilters.locations);

  const [technologiesText, setTechnologiesText] = useState(initialFilters.technologies.join(", "));
  const [technologies, setTechnologies] = useState(initialFilters.technologies);

  const [industriesText, setIndustriesText] = useState(initialFilters.industries.join(", "));
  const [industries, setIndustries] = useState(initialFilters.industries);

  const [semanticEnabled, setSemanticEnabled] = useState(initialFilters.semanticEnabled);
  const [similarityThreshold, setSimilarityThreshold] = useState(initialFilters.similarityThreshold);

  const [results, setResults] = useState(initialResults);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [isLoading, setIsLoading] = useState(false);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const buildSearchParams = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams();
      if (keyword.trim()) {
        params.set("q", keyword.trim());
      }
      skills.forEach((value) => params.append("skills", value));
      roles.forEach((value) => params.append("role", value));
      education.forEach((value) => params.append("education", value));
      certifications.forEach((value) => params.append("certification", value));
      languages.forEach((value) => params.append("language", value));
      locations.forEach((value) => params.append("location", value));
      technologies.forEach((value) => params.append("technology", value));
      industries.forEach((value) => params.append("industry", value));
      params.set("semantic", semanticEnabled ? "1" : "0");
      if (Number.isFinite(similarityThreshold)) {
        params.set("semanticThreshold", similarityThreshold.toString());
      }
      params.set("page", nextPage.toString());
      params.set("pageSize", pageSize.toString());
      return params;
    },
    [
      certifications,
      education,
      industries,
      keyword,
      languages,
      locations,
      pageSize,
      roles,
      semanticEnabled,
      similarityThreshold,
      skills,
      technologies
    ]
  );

  const executeSearch = useCallback(
    async (nextPage = 1) => {
      setIsLoading(true);
      const params = buildSearchParams(nextPage);

      try {
        const response = await fetch(`/api/cvs/list?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = (await response.json()) as {
          items: SearchResultItem[];
          suggestions?: SearchSuggestion[];
          total: number;
          page: number;
          pageSize: number;
        };

        setResults(data.items);
        setSuggestions(data.suggestions ?? []);
        setTotal(data.total);
        setPage(data.page);
        setPageSize(data.pageSize);

        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.search = params.toString();
          window.history.replaceState(null, "", url.toString());
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    },
    [buildSearchParams]
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      executeSearch(1);
    },
    [executeSearch]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: SearchSuggestion) => {
      const value = suggestion.value;
      const addValue = (
        setArray: Dispatch<SetStateAction<string[]>>,
        setText: Dispatch<SetStateAction<string>>
      ) => {
        setArray((prev) => {
          if (prev.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
            return prev;
          }
          const next = [...prev, value];
          setText(next.join(", "));
          return next;
        });
      };

      switch (suggestion.type) {
        case "experience":
          addValue(setRoles, setRolesText);
          break;
        case "education":
          addValue(setEducation, setEducationText);
          break;
        case "skill":
          addValue(setSkills, setSkillsText);
          break;
        case "language":
          addValue(setLanguages, setLanguagesText);
          break;
        case "certification":
          addValue(setCertifications, setCertificationsText);
          break;
        default:
          addValue(setSkills, setSkillsText);
          break;
      }

      setSemanticEnabled(true);
      setTimeout(() => {
        void executeSearch(1);
      }, 0);
    },
    [
      executeSearch,
      setCertifications,
      setCertificationsText,
      setEducation,
      setEducationText,
      setLanguages,
      setLanguagesText,
      setRoles,
      setRolesText,
      setSemanticEnabled,
      setSkills,
      setSkillsText
    ]
  );

  return (
    <section style={{ display: "grid", gap: "1.5rem" }}>
      <header>
        <h1>Search CVs</h1>
        <p>Combine keyword and structured filters. Semantic suggestions refine your search faster.</p>
      </header>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: "1rem",
          border: "1px solid #d0d7de",
          padding: "1rem",
          borderRadius: "8px",
          background: "#f6f8fa"
        }}
      >
        <div style={{ display: "grid", gap: "0.25rem" }}>
          <label style={{ fontWeight: 600 }}>Keyword</label>
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="e.g. frontend architect"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          <FilterInput label="Skills" value={skillsText} onChange={(value) => {
            setSkillsText(value);
            setSkills(parseList(value));
          }} />
          <FilterInput label="Roles" value={rolesText} onChange={(value) => {
            setRolesText(value);
            setRoles(parseList(value));
          }} />
          <FilterInput label="Education" value={educationText} onChange={(value) => {
            setEducationText(value);
            setEducation(parseList(value));
          }} />
          <FilterInput label="Certifications" value={certificationsText} onChange={(value) => {
            setCertificationsText(value);
            setCertifications(parseList(value));
          }} />
          <FilterInput label="Languages" value={languagesText} onChange={(value) => {
            setLanguagesText(value);
            setLanguages(parseList(value));
          }} />
          <FilterInput label="Locations" value={locationsText} onChange={(value) => {
            setLocationsText(value);
            setLocations(parseList(value));
          }} />
          <FilterInput label="Technologies" value={technologiesText} onChange={(value) => {
            setTechnologiesText(value);
            setTechnologies(parseList(value));
          }} />
          <FilterInput label="Industries" value={industriesText} onChange={(value) => {
            setIndustriesText(value);
            setIndustries(parseList(value));
          }} />
        </div>

        <fieldset style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={semanticEnabled}
              onChange={(event) => setSemanticEnabled(event.target.checked)}
            />
            Enable semantic suggestions
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            Similarity threshold
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={similarityThreshold}
              onChange={(event) => setSimilarityThreshold(Number.parseFloat(event.target.value) || 0)}
              style={{ width: "4rem" }}
            />
          </label>
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Searching..." : "Search"}
          </button>
        </fieldset>
      </form>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <h2>Suggestions</h2>
        {suggestions.length === 0 ? (
          <p>No suggestions yet. Try running a keyword search to seed semantic matches.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {suggestions.map((suggestion) => (
              <button
                key={`${suggestion.type}-${suggestion.value}`}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                style={{
                  border: "1px solid #0969da",
                  background: "white",
                  color: "#0969da",
                  borderRadius: "999px",
                  padding: "0.35rem 0.75rem",
                  cursor: "pointer"
                }}
              >
                {suggestion.value}
                <small style={{ marginLeft: "0.35rem", color: "#57606a" }}>
                  {(suggestion.score * 100).toFixed(0)}%
                </small>
              </button>
            ))}
          </div>
        )}
      </section>

      <section style={{ display: "grid", gap: "1rem" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Results</h2>
          <span>
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
          </span>
        </header>

        {results.length === 0 ? (
          <p>No CVs match your filters yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "1rem" }}>
            {results.map((result) => (
              <li
                key={result.id}
                style={{
                  border: "1px solid #d0d7de",
                  borderRadius: "8px",
                  padding: "1rem",
                  display: "grid",
                  gap: "0.75rem"
                }}
              >
                <header>
                  <h3 style={{ margin: 0 }}>{result.consultant.name}</h3>
                  {result.consultant.title ? (
                    <p style={{ margin: 0, color: "#57606a" }}>{result.consultant.title}</p>
                  ) : null}
                </header>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <span>Availability: {result.availability.status}</span>
                  {result.consultant.location ? <span>Location: {result.consultant.location}</span> : null}
                  {result.consultant.languages.length ? (
                    <span>Languages: {result.consultant.languages.join(", ")}</span>
                  ) : null}
                </div>
                {result.skills.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {result.skills.slice(0, 8).map((skill) => (
                      <span
                        key={`${result.id}-skill-${skill.name}`}
                        style={{
                          background: "#eaeef2",
                          borderRadius: "999px",
                          padding: "0.25rem 0.75rem",
                          fontSize: "0.85rem"
                        }}
                      >
                        {skill.name}
                      </span>
                    ))}
                  </div>
                ) : null}
                <footer style={{ fontSize: "0.85rem", color: "#57606a" }}>
                  Updated {new Date(result.updatedAt).toLocaleDateString()}
                </footer>
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button type="button" disabled={page <= 1 || isLoading} onClick={() => executeSearch(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => executeSearch(page + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </section>
  );
}

interface FilterInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function FilterInput({ label, value, onChange }: FilterInputProps) {
  return (
    <label style={{ display: "grid", gap: "0.25rem" }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
      <small style={{ color: "#57606a" }}>Comma-separated values</small>
    </label>
  );
}
