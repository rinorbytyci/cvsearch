"use client";

import type { ChangeEvent } from "react";
import { useCallback, useMemo } from "react";

import type { CvSearchFilters } from "@/lib/cv/search";

export interface TaxonomyOption {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface CvFilterPanelProps {
  filters: CvSearchFilters;
  onChange: (filters: CvSearchFilters) => void;
  taxonomy: {
    skills: TaxonomyOption[];
    industries: TaxonomyOption[];
    technologies: TaxonomyOption[];
  };
}

const SENIORITY_OPTIONS = ["Intern", "Junior", "Mid", "Senior", "Lead", "Principal"];
const AVAILABILITY_OPTIONS = ["available", "soon", "unavailable", "unknown"];

type ArrayFilterKey = keyof {
  [Key in keyof CvSearchFilters as CvSearchFilters[Key] extends string[] | undefined ? Key : never]: true;
};

function toggleValue(values: string[] | undefined, value: string) {
  const current = values ?? [];
  const filtered = current.filter((existing) => existing.toLowerCase() !== value.toLowerCase());

  if (filtered.length === current.length) {
    return [...current, value];
  }

  return filtered;
}

function ensureArray(values: string[] | undefined) {
  return values ?? [];
}

export function CvFilterPanel({ filters, onChange, taxonomy }: CvFilterPanelProps) {
  const handleToggle = useCallback(
    (key: ArrayFilterKey, value: string) => {
      const filterMap = filters as Partial<Record<ArrayFilterKey, string[] | undefined>>;
      const currentValues = filterMap[key];
      const nextValues = toggleValue(currentValues, value);
      const updated = { ...filters } as CvSearchFilters;
      (updated as Partial<Record<ArrayFilterKey, string[] | undefined>>)[key] = nextValues;
      onChange(updated);
    },
    [filters, onChange]
  );

  const handleLanguagesChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const values = event.target.value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      onChange({ ...filters, languages: values });
    },
    [filters, onChange]
  );

  const handleLocationsChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const values = event.target.value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      onChange({ ...filters, locations: values });
    },
    [filters, onChange]
  );

  const selectedLanguages = useMemo(() => ensureArray(filters.languages).join(", "), [filters.languages]);
  const selectedLocations = useMemo(() => ensureArray(filters.locations).join(", "), [filters.locations]);

  return (
    <aside className="cv-filter-panel">
      <h2>Filters</h2>
      <div className="filter-section">
        <h3>Skills</h3>
        <ul>
          {taxonomy.skills.map((skill) => {
            const isChecked = ensureArray(filters.skills).some(
              (value) => value.toLowerCase() === skill.name.toLowerCase()
            );
            return (
              <li key={skill.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle("skills", skill.name)}
                  />
                  <span>{skill.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="filter-section">
        <h3>Technologies</h3>
        <ul>
          {taxonomy.technologies.map((technology) => {
            const isChecked = ensureArray(filters.technologies).some(
              (value) => value.toLowerCase() === technology.name.toLowerCase()
            );
            return (
              <li key={technology.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle("technologies", technology.name)}
                  />
                  <span>{technology.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="filter-section">
        <h3>Industries</h3>
        <ul>
          {taxonomy.industries.map((industry) => {
            const isChecked = ensureArray(filters.industries).some(
              (value) => value.toLowerCase() === industry.name.toLowerCase()
            );
            return (
              <li key={industry.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle("industries", industry.name)}
                  />
                  <span>{industry.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="filter-section">
        <h3>Seniority</h3>
        <ul>
          {SENIORITY_OPTIONS.map((option) => {
            const isChecked = ensureArray(filters.seniority).some(
              (value) => value.toLowerCase() === option.toLowerCase()
            );
            return (
              <li key={option}>
                <label>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle("seniority", option)}
                  />
                  <span>{option}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="filter-section">
        <h3>Availability</h3>
        <ul>
          {AVAILABILITY_OPTIONS.map((option) => {
            const isChecked = ensureArray(filters.availability).includes(option);
            return (
              <li key={option}>
                <label>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle("availability", option)}
                  />
                  <span>{option}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="filter-section">
        <h3>Languages</h3>
        <input
          type="text"
          value={selectedLanguages}
          placeholder="e.g. English, German"
          onChange={handleLanguagesChange}
        />
        <p className="field-description">Separate multiple languages with commas.</p>
      </div>

      <div className="filter-section">
        <h3>Locations</h3>
        <input
          type="text"
          value={selectedLocations}
          placeholder="e.g. Berlin, Remote"
          onChange={handleLocationsChange}
        />
        <p className="field-description">Separate multiple locations with commas.</p>
      </div>

      <style jsx>{`
        .cv-filter-panel {
          border: 1px solid #d0d7de;
          border-radius: 8px;
          padding: 1.5rem;
          background: #f6f8fa;
        }

        .cv-filter-panel h2 {
          margin-top: 0;
        }

        .filter-section + .filter-section {
          margin-top: 1.5rem;
        }

        .filter-section h3 {
          margin-bottom: 0.5rem;
          font-size: 1rem;
        }

        .filter-section ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 0.25rem;
        }

        .filter-section label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .filter-section input[type="text"] {
          width: 100%;
          padding: 0.5rem;
          border-radius: 4px;
          border: 1px solid #d0d7de;
        }

        .field-description {
          font-size: 0.8rem;
          color: #57606a;
          margin-top: 0.25rem;
        }
      `}</style>
    </aside>
  );
}

