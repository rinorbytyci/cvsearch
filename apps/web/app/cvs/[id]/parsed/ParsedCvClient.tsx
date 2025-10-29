"use client";

import { useCallback, useMemo, useState } from "react";

interface ParsedEntityView {
  id: string | null;
  entityType: string;
  label: string;
  confidence: number;
  source: "parser" | "manual" | string;
  metadata?: Record<string, unknown>;
  embedding?: number[] | null;
}

interface ParsedCvClientProps {
  cvId: string;
  versionId: string | null;
  consultantName: string;
  parseStatus: string;
  parsedAt: string | null;
  parseError: string | null;
  entities: ParsedEntityView[];
}

type ManualDraft = ParsedEntityView;

type FormStatus = { variant: "idle" | "saving" | "success" | "error"; message?: string };

const ENTITY_OPTIONS = [
  { value: "summary", label: "Summary" },
  { value: "experience", label: "Roles" },
  { value: "education", label: "Education" },
  { value: "skill", label: "Skills" },
  { value: "language", label: "Languages" },
  { value: "certification", label: "Certifications" }
];

export function ParsedCvClient({
  cvId,
  versionId,
  consultantName,
  parseStatus,
  parsedAt,
  parseError,
  entities
}: ParsedCvClientProps) {
  const [allEntities, setAllEntities] = useState<ParsedEntityView[]>(entities);
  const [manualDrafts, setManualDrafts] = useState<ManualDraft[]>(
    entities.filter((entity) => entity.source === "manual")
  );
  const [status, setStatus] = useState<FormStatus>({ variant: "idle" });
  const [reparseStatus, setReparseStatus] = useState<FormStatus>({ variant: "idle" });

  const parserEntities = useMemo(
    () => allEntities.filter((entity) => entity.source !== "manual"),
    [allEntities]
  );

  const handleAddManual = useCallback(() => {
    setManualDrafts((drafts) => [
      ...drafts,
      {
        id: null,
        entityType: "skill",
        label: "",
        confidence: 0.9,
        source: "manual",
        metadata: {}
      }
    ]);
  }, []);

  const handleManualChange = useCallback(
    (index: number, key: keyof ManualDraft, value: string | number) => {
      setManualDrafts((drafts) => {
        const next = [...drafts];
        const draft = { ...next[index] };
        if (key === "confidence" && typeof value === "number") {
          draft.confidence = value;
        } else if (key === "label" && typeof value === "string") {
          draft.label = value;
        } else if (key === "entityType" && typeof value === "string") {
          draft.entityType = value;
        }
        next[index] = draft;
        return next;
      });
    },
    []
  );

  const handleRemoveManual = useCallback((index: number) => {
    setManualDrafts((drafts) => drafts.filter((_, current) => current !== index));
  }, []);

  const handleSaveManual = useCallback(async () => {
    if (!versionId) {
      setStatus({ variant: "error", message: "No CV version available for manual updates." });
      return;
    }

    setStatus({ variant: "saving", message: "Saving manual corrections..." });

    const payload = {
      versionId,
      entities: manualDrafts
        .filter((draft) => draft.label.trim().length)
        .map((draft) => ({
          entityType: draft.entityType,
          label: draft.label.trim(),
          confidence: draft.confidence,
          metadata: draft.metadata ?? {}
        }))
    };

    try {
      const response = await fetch(`/api/cvs/${cvId}/parse`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error ?? "Failed to save manual corrections");
      }

      const data = (await response.json()) as {
        entities: ParsedEntityView[];
      };

      setAllEntities(data.entities);
      setManualDrafts(data.entities.filter((entity) => entity.source === "manual"));
      setStatus({ variant: "success", message: "Manual corrections saved" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save manual corrections";
      setStatus({ variant: "error", message });
    }
  }, [cvId, manualDrafts, versionId]);

  const handleReparse = useCallback(async () => {
    if (!versionId) {
      setReparseStatus({ variant: "error", message: "No CV version available to parse." });
      return;
    }

    setReparseStatus({ variant: "saving", message: "Queuing CV for parsing..." });

    try {
      const response = await fetch(`/api/cvs/${cvId}/parse`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionId })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error ?? "Failed to queue parsing");
      }

      setReparseStatus({
        variant: "success",
        message: "Parsing queued. Refresh this view after the worker completes."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to queue parsing";
      setReparseStatus({ variant: "error", message });
    }
  }, [cvId, versionId]);

  return (
    <section style={{ display: "grid", gap: "1.5rem" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <h1>Parsed entities for {consultantName}</h1>
        <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "0.5rem" }}>
          <dt>Status</dt>
          <dd style={{ margin: 0, textTransform: "capitalize" }}>{parseStatus}</dd>
          <dt>Last parsed</dt>
          <dd style={{ margin: 0 }}>{parsedAt ? new Date(parsedAt).toLocaleString() : "Never"}</dd>
          {parseError ? (
            <>
              <dt>Error</dt>
              <dd style={{ margin: 0, color: "#d1242f" }}>{parseError}</dd>
            </>
          ) : null}
        </dl>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button type="button" onClick={handleReparse} disabled={reparseStatus.variant === "saving"}>
            {reparseStatus.variant === "saving" ? "Queuing..." : "Re-parse latest version"}
          </button>
          {reparseStatus.message ? (
            <span
              style={{
                color: reparseStatus.variant === "error" ? "#d1242f" : "#1a7f37",
                fontSize: "0.9rem"
              }}
            >
              {reparseStatus.message}
            </span>
          ) : null}
        </div>
      </header>

      <section style={{ display: "grid", gap: "1rem" }}>
        <h2>Parser extracted entities</h2>
        {parserEntities.length === 0 ? (
          <p>No parser-sourced entities available yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #d0d7de" }}>
                  Type
                </th>
                <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #d0d7de" }}>
                  Label
                </th>
                <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #d0d7de" }}>
                  Confidence
                </th>
              </tr>
            </thead>
            <tbody>
              {parserEntities.map((entity) => (
                <tr key={`${entity.entityType}-${entity.id ?? entity.label}`}>
                  <td style={{ padding: "0.5rem", borderBottom: "1px solid #eef1f4", textTransform: "capitalize" }}>
                    {entity.entityType}
                  </td>
                  <td style={{ padding: "0.5rem", borderBottom: "1px solid #eef1f4" }}>{entity.label}</td>
                  <td style={{ padding: "0.5rem", borderBottom: "1px solid #eef1f4" }}>
                    {(entity.confidence * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ display: "grid", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Manual corrections</h2>
          <button type="button" onClick={handleAddManual}>
            Add entity
          </button>
        </div>
        {manualDrafts.length === 0 ? (
          <p>No manual corrections recorded.</p>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {manualDrafts.map((draft, index) => (
              <div
                key={`manual-${index}`}
                style={{
                  border: "1px solid #d0d7de",
                  borderRadius: "8px",
                  padding: "1rem",
                  display: "grid",
                  gap: "0.75rem"
                }}
              >
                <div style={{ display: "grid", gap: "0.25rem" }}>
                  <label style={{ fontWeight: 600 }}>Entity type</label>
                  <select
                    value={draft.entityType}
                    onChange={(event) => handleManualChange(index, "entityType", event.target.value)}
                  >
                    {ENTITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "grid", gap: "0.25rem" }}>
                  <label style={{ fontWeight: 600 }}>Label</label>
                  <input
                    type="text"
                    value={draft.label}
                    onChange={(event) => handleManualChange(index, "label", event.target.value)}
                  />
                </div>
                <div style={{ display: "grid", gap: "0.25rem" }}>
                  <label style={{ fontWeight: 600 }}>Confidence</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={draft.confidence}
                    onChange={(event) =>
                      handleManualChange(index, "confidence", Number.parseFloat(event.target.value))
                    }
                  />
                </div>
                <div>
                  <button type="button" onClick={() => handleRemoveManual(index)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={handleSaveManual}
            disabled={status.variant === "saving"}
          >
            {status.variant === "saving" ? "Saving..." : "Save manual corrections"}
          </button>
          {status.message ? (
            <span
              style={{
                color: status.variant === "error" ? "#d1242f" : "#1a7f37",
                fontSize: "0.9rem"
              }}
            >
              {status.message}
            </span>
          ) : null}
        </div>
      </section>
    </section>
  );
}
