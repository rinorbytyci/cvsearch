"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import { useI18n } from "@/i18n/provider";

export type ConsentStatus = "pending" | "granted" | "revoked";

export interface ConsentHistoryEntry {
  status: ConsentStatus;
  note: string | null;
  policyVersion: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface ConsentViewModel {
  status: ConsentStatus;
  note: string | null;
  languagePreference: string | null;
  policyVersion: string | null;
  consentedAt: string | null;
  revokedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
  legalHold: {
    active: boolean;
    reason: string | null;
    setAt: string | null;
    setBy: string | null;
  };
  history: ConsentHistoryEntry[];
}

interface Props {
  consultantId: string;
  initialConsent: ConsentViewModel;
}

export function ConsentPanel({ consultantId, initialConsent }: Props) {
  const { locale, t } = useI18n();
  const [formState, setFormState] = useState({
    status: initialConsent.status,
    languagePreference: initialConsent.languagePreference ?? "",
    note: initialConsent.note ?? "",
    policyVersion: initialConsent.policyVersion ?? "",
    legalHoldActive: initialConsent.legalHold.active,
    legalHoldReason: initialConsent.legalHold.reason ?? ""
  });
  const [history, setHistory] = useState<ConsentHistoryEntry[]>(initialConsent.history);
  const [metadata, setMetadata] = useState({
    updatedAt: initialConsent.updatedAt,
    updatedBy: initialConsent.updatedBy,
    consentedAt: initialConsent.consentedAt,
    revokedAt: initialConsent.revokedAt,
    legalHold: initialConsent.legalHold
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const statusOptions = useMemo(() => {
    return [
      { value: "pending", label: t("consent.status.pending") },
      { value: "granted", label: t("consent.status.granted") },
      { value: "revoked", label: t("consent.status.revoked") }
    ] as const;
  }, [t]);

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }), [locale]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/consultants/${consultantId}/consent`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: formState.status,
          languagePreference: formState.languagePreference || null,
          note: formState.note || null,
          policyVersion: formState.policyVersion || null,
          legalHold: {
            active: formState.legalHoldActive,
            reason: formState.legalHoldReason || null
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ConsentViewModel;
      setHistory(payload.history);
      setMetadata({
        updatedAt: payload.updatedAt,
        updatedBy: payload.updatedBy,
        consentedAt: payload.consentedAt,
        revokedAt: payload.revokedAt,
        legalHold: payload.legalHold
      });
      setFormState((previous) => ({
        ...previous,
        status: payload.status,
        languagePreference: payload.languagePreference ?? "",
        note: payload.note ?? "",
        policyVersion: payload.policyVersion ?? "",
        legalHoldActive: payload.legalHold.active,
        legalHoldReason: payload.legalHold.reason ?? ""
      }));
      setMessage({ type: "success", text: t("consent.toastSuccess") });
    } catch (error) {
      console.error("Failed to update consent", error);
      setMessage({ type: "error", text: t("consent.toastError") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem", maxWidth: "32rem" }}>
        <label style={{ display: "grid", gap: "0.5rem" }}>
          <span>{t("consent.statusLabel")}</span>
          <select
            value={formState.status}
            onChange={(event) => setFormState((previous) => ({ ...previous, status: event.target.value as ConsentStatus }))}
            disabled={submitting}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: "0.5rem" }}>
          <span>{t("consent.languagePreferenceLabel")}</span>
          <input
            type="text"
            value={formState.languagePreference}
            placeholder={t("consent.languagePlaceholder")}
            onChange={(event) => setFormState((previous) => ({ ...previous, languagePreference: event.target.value }))}
            disabled={submitting}
          />
        </label>

        <label style={{ display: "grid", gap: "0.5rem" }}>
          <span>{t("consent.policyVersionLabel")}</span>
          <input
            type="text"
            value={formState.policyVersion}
            onChange={(event) => setFormState((previous) => ({ ...previous, policyVersion: event.target.value }))}
            disabled={submitting}
          />
        </label>

        <label style={{ display: "grid", gap: "0.5rem" }}>
          <span>{t("consent.noteLabel")}</span>
          <textarea
            value={formState.note}
            placeholder={t("consent.notePlaceholder")}
            onChange={(event) => setFormState((previous) => ({ ...previous, note: event.target.value }))}
            disabled={submitting}
            rows={3}
          />
        </label>

        <fieldset style={{ border: "1px solid #ccc", padding: "1rem", borderRadius: "0.5rem" }}>
          <legend>{t("consent.legalHoldLabel")}</legend>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={formState.legalHoldActive}
              onChange={(event) => setFormState((previous) => ({ ...previous, legalHoldActive: event.target.checked }))}
              disabled={submitting}
            />
            <span>{formState.legalHoldActive ? t("consent.legalHoldActive") : t("consent.legalHoldInactive")}</span>
          </label>
          <label style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
            <span>{t("consent.noteLabel")}</span>
            <input
              type="text"
              value={formState.legalHoldReason}
              onChange={(event) => setFormState((previous) => ({ ...previous, legalHoldReason: event.target.value }))}
              disabled={submitting || !formState.legalHoldActive}
            />
          </label>
        </fieldset>

        <button type="submit" disabled={submitting}>
          {submitting ? "…" : t("consent.updateButton")}
        </button>
        {message ? (
          <p style={{ color: message.type === "success" ? "green" : "crimson" }}>{message.text}</p>
        ) : null}
      </form>

      <section style={{ display: "grid", gap: "0.5rem" }}>
        <div>
          <strong>{t("consent.lastUpdated")}:</strong>{" "}
          {dateFormatter.format(new Date(metadata.updatedAt))}
          {metadata.updatedBy ? (
            <span>
              {" "}({t("consent.updatedBy")}: {metadata.updatedBy})
            </span>
          ) : null}
        </div>
        {metadata.consentedAt ? (
          <div>
            <strong>{t("consent.consentedAt")}:</strong>{" "}
            {dateFormatter.format(new Date(metadata.consentedAt))}
          </div>
        ) : null}
        {metadata.revokedAt ? (
          <div>
            <strong>{t("consent.revokedAt")}:</strong>{" "}
            {dateFormatter.format(new Date(metadata.revokedAt))}
          </div>
        ) : null}
        <div>
          <strong>{t("consent.legalHoldLabel")}:</strong>{" "}
          {metadata.legalHold.active ? t("consent.legalHoldActive") : t("consent.legalHoldInactive")}
          {metadata.legalHold.reason ? ` – ${metadata.legalHold.reason}` : ""}
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.5rem" }}>
        <h3>{t("consent.historyTitle")}</h3>
        {history.length === 0 ? (
          <p>{t("consent.historyEmpty")}</p>
        ) : (
          <ul style={{ display: "grid", gap: "0.75rem", listStyle: "none", padding: 0 }}>
            {history
              .slice()
              .reverse()
              .map((entry, index) => (
                <li
                  key={`${entry.updatedAt}-${index}`}
                  style={{ border: "1px solid #e5e7eb", padding: "0.75rem", borderRadius: "0.5rem" }}
                >
                  <div>
                    <strong>{dateFormatter.format(new Date(entry.updatedAt))}</strong>
                  </div>
                  <div>{t(`consent.status.${entry.status}`)}</div>
                  {entry.note ? <div>{entry.note}</div> : null}
                  {entry.policyVersion ? (
                    <div>
                      {t("consent.policyVersionLabel")}: {entry.policyVersion}
                    </div>
                  ) : null}
                  {entry.updatedBy ? (
                    <div>
                      {t("consent.updatedBy")}: {entry.updatedBy}
                    </div>
                  ) : null}
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
