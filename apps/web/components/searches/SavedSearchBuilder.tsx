"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CvFilterPanel, type TaxonomyOption } from "@/components/cv/CvFilterPanel";
import { CvList, type CvListItemProps } from "@/components/cv/CvList";
import type { CvSearchFilters } from "@/lib/cv/search";

interface SavedSearchBuilderProps {
  taxonomy: {
    skills: TaxonomyOption[];
    industries: TaxonomyOption[];
    technologies: TaxonomyOption[];
  };
  initialFilters?: CvSearchFilters;
  savedSearchId?: string | null;
  initialName?: string;
  initialDescription?: string | null;
  initialNotifications?: {
    emailEnabled?: boolean;
    emailRecipients?: string[];
    webhookEnabled?: boolean;
    webhookUrl?: string | null;
    webhookSecret?: string | null;
  };
}

interface CvListResponseItem extends CvListItemProps {}

interface CvListResponse {
  items: CvListResponseItem[];
  total: number;
  page: number;
  pageSize: number;
}

function filtersToQuery(filters: CvSearchFilters) {
  const params = new URLSearchParams();
  const appendValues = (key: string, values: string[] | undefined) => {
    for (const value of values ?? []) {
      params.append(key, value);
    }
  };

  appendValues("skills", filters.skills);
  appendValues("technology", filters.technologies);
  appendValues("industry", filters.industries);
  appendValues("seniority", filters.seniority);
  appendValues("availability", filters.availability);
  appendValues("language", filters.languages);
  appendValues("location", filters.locations);

  return params.toString();
}

function normalizeFilters(filters?: CvSearchFilters): CvSearchFilters {
  if (!filters) {
    return {};
  }

  const normalize = (values?: string[]) => values?.map((value) => value.trim()).filter(Boolean);

  return {
    skills: normalize(filters.skills),
    technologies: normalize(filters.technologies),
    industries: normalize(filters.industries),
    seniority: normalize(filters.seniority),
    availability: normalize(filters.availability),
    languages: normalize(filters.languages),
    locations: normalize(filters.locations)
  };
}

export function SavedSearchBuilder({
  taxonomy,
  initialFilters,
  savedSearchId,
  initialName,
  initialDescription,
  initialNotifications
}: SavedSearchBuilderProps) {
  const [filters, setFilters] = useState<CvSearchFilters>(() => normalizeFilters(initialFilters));
  const [results, setResults] = useState<CvListItemProps[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialName ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");

  const [emailEnabled, setEmailEnabled] = useState(initialNotifications?.emailEnabled ?? false);
  const [emailRecipients, setEmailRecipients] = useState(
    (initialNotifications?.emailRecipients ?? []).join(", ")
  );
  const [webhookEnabled, setWebhookEnabled] = useState(initialNotifications?.webhookEnabled ?? false);
  const [webhookUrl, setWebhookUrl] = useState(initialNotifications?.webhookUrl ?? "");
  const [webhookSecret, setWebhookSecret] = useState(initialNotifications?.webhookSecret ?? "");

  const [currentSearchId, setCurrentSearchId] = useState<string | null>(savedSearchId ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    const query = filtersToQuery(filters);
    const url = query ? `/api/cvs/list?${query}` : "/api/cvs/list";

    setIsLoading(true);
    setError(null);

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch CVs (${response.status})`);
        }

        return (await response.json()) as CvListResponse;
      })
      .then((data) => {
        if (!isActive) {
          return;
        }

        setResults(data.items ?? []);
        setTotalResults(data.total ?? data.items.length);
      })
      .catch((fetchError: unknown) => {
        if (!isActive) {
          return;
        }

        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : "Unable to load CVs";
        setError(message);
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  const handleFiltersChange = useCallback((nextFilters: CvSearchFilters) => {
    setFilters(normalizeFilters(nextFilters));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    const recipients = emailRecipients
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const body = {
      name,
      description,
      filters,
      notifications: {
        email: { enabled: emailEnabled, recipients },
        webhook: {
          enabled: webhookEnabled,
          url: webhookUrl || undefined,
          secret: webhookSecret || undefined
        }
      }
    };

    try {
      const response = await fetch(currentSearchId ? `/api/searches/${currentSearchId}` : "/api/searches", {
        method: currentSearchId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          typeof errorData?.error === "string"
            ? errorData.error
            : `Failed to save search (${response.status})`;
        throw new Error(message);
      }

      const saved = (await response.json()) as { id: string; name: string };
      const updatedId = saved.id ?? currentSearchId;
      setCurrentSearchId(updatedId ?? null);
      setSaveSuccess(currentSearchId ? "Saved search updated" : "Saved search created");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save search";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }, [
    currentSearchId,
    description,
    emailEnabled,
    emailRecipients,
    filters,
    name,
    webhookEnabled,
    webhookSecret,
    webhookUrl
  ]);

  useEffect(() => {
    if (!saveSuccess) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSaveSuccess(null);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [saveSuccess]);

  return (
    <div className="saved-search-builder">
      <div className="layout">
        <div className="sidebar">
          <CvFilterPanel filters={filters} onChange={handleFiltersChange} taxonomy={taxonomy} />
        </div>
        <div className="content">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <div className="form-row">
              <label>
                <span>Search name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                />
              </label>
            </div>
            <fieldset>
              <legend>Notifications</legend>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(event) => setEmailEnabled(event.target.checked)}
                />
                <span>Send email alerts</span>
              </label>
              {emailEnabled ? (
                <label className="sub-field">
                  <span>Email recipients</span>
                  <input
                    type="text"
                    placeholder="person@example.com"
                    value={emailRecipients}
                    onChange={(event) => setEmailRecipients(event.target.value)}
                  />
                </label>
              ) : null}

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={webhookEnabled}
                  onChange={(event) => setWebhookEnabled(event.target.checked)}
                />
                <span>Send webhook notifications</span>
              </label>
              {webhookEnabled ? (
                <div className="webhook-fields">
                  <label>
                    <span>Webhook URL</span>
                    <input
                      type="url"
                      placeholder="https://example.com/hooks/cv"
                      value={webhookUrl}
                      onChange={(event) => setWebhookUrl(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Webhook secret</span>
                    <input
                      type="text"
                      value={webhookSecret}
                      onChange={(event) => setWebhookSecret(event.target.value)}
                      placeholder="Optional secret for signature"
                    />
                  </label>
                </div>
              ) : null}
            </fieldset>

            <div className="actions">
              <button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save search"}
              </button>
              {saveError ? <p className="error">{saveError}</p> : null}
              {saveSuccess ? <p className="success">{saveSuccess}</p> : null}
              {currentSearchId ? (
                <p className="helper">Saved as ID {currentSearchId}</p>
              ) : null}
            </div>
          </form>

          <div className="results">
            <header className="results-header">
              <h3>Matching CVs</h3>
              <span>{totalResults} total</span>
            </header>
            <CvList items={results} isLoading={isLoading} error={error} />
          </div>
        </div>
      </div>

      <style jsx>{`
        .saved-search-builder {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(260px, 320px) 1fr;
          gap: 1.5rem;
        }

        .form-row {
          display: flex;
          flex-direction: column;
          margin-bottom: 1rem;
        }

        label span,
        legend {
          font-weight: 600;
          margin-bottom: 0.5rem;
          display: inline-block;
        }

        input[type="text"],
        input[type="url"],
        textarea {
          width: 100%;
          padding: 0.5rem;
          border-radius: 4px;
          border: 1px solid #d0d7de;
          font-size: 1rem;
        }

        fieldset {
          border: 1px solid #d0d7de;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .sub-field {
          display: flex;
          flex-direction: column;
          margin-bottom: 0.75rem;
        }

        .webhook-fields {
          display: grid;
          gap: 0.75rem;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        button[type="submit"] {
          background: #0969da;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 0.5rem 1.25rem;
          font-size: 1rem;
          cursor: pointer;
        }

        button[disabled] {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error {
          color: #b31d28;
        }

        .success {
          color: #1a7f37;
        }

        .results {
          margin-top: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        @media (max-width: 960px) {
          .layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

