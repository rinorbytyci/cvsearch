export const locales = ["en", "de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export interface Messages {
  common: {
    appName: string;
    footer: string;
    nav: {
      search: string;
      savedSearches: string;
      consent: string;
    };
    language: {
      label: string;
      english: string;
      german: string;
    };
  };
  home: {
    welcome: string;
    description: string;
    consentCta: string;
  };
  consent: {
    heading: string;
    description: string;
    statusLabel: string;
    status: {
      granted: string;
      revoked: string;
      pending: string;
    };
    updateButton: string;
    noteLabel: string;
    languagePreferenceLabel: string;
    policyVersionLabel: string;
    legalHoldLabel: string;
    legalHoldActive: string;
    legalHoldInactive: string;
    historyTitle: string;
    historyEmpty: string;
    lastUpdated: string;
    consentedAt: string;
    revokedAt: string;
    updatedBy: string;
    languagePlaceholder: string;
    notePlaceholder: string;
    toastSuccess: string;
    toastError: string;
  };
}

const dictionaries: Record<Locale, Messages> = {
  en: {
    common: {
      appName: "CV Search",
      footer: "CV Search",
      nav: {
        search: "Search",
        savedSearches: "Saved searches",
        consent: "Consent"
      },
      language: {
        label: "Language",
        english: "English",
        german: "Deutsch"
      }
    },
    home: {
      welcome: "Welcome to CV Search",
      description:
        "Discover and manage consultant CVs with built-in privacy controls, consent workflows, and automated data governance.",
      consentCta: "Review consultant consent preferences"
    },
    consent: {
      heading: "Consultant consent",
      description:
        "Review the consultant's consent status, track updates, and manage legal-hold overrides when necessary.",
      statusLabel: "Current status",
      status: {
        granted: "Granted",
        revoked: "Revoked",
        pending: "Pending"
      },
      updateButton: "Save updates",
      noteLabel: "Notes",
      languagePreferenceLabel: "Preferred language",
      policyVersionLabel: "Policy version",
      legalHoldLabel: "Legal hold",
      legalHoldActive: "Active",
      legalHoldInactive: "Inactive",
      historyTitle: "Consent history",
      historyEmpty: "No consent changes have been recorded yet.",
      lastUpdated: "Last updated",
      consentedAt: "Consented",
      revokedAt: "Revoked",
      updatedBy: "Updated by",
      languagePlaceholder: "e.g. en-GB",
      notePlaceholder: "Add an optional reason for the change",
      toastSuccess: "Consent preferences saved",
      toastError: "Failed to update consent preferences"
    }
  },
  de: {
    common: {
      appName: "CV Search",
      footer: "CV Search",
      nav: {
        search: "Suche",
        savedSearches: "Gespeicherte Suchen",
        consent: "Einwilligung"
      },
      language: {
        label: "Sprache",
        english: "Englisch",
        german: "Deutsch"
      }
    },
    home: {
      welcome: "Willkommen bei CV Search",
      description:
        "Entdecken und verwalten Sie Beraterprofile mit eingebautem Datenschutz, Einwilligungsprozessen und automatisierter Daten-Governance.",
      consentCta: "Einwilligungsstatus der Berater prüfen"
    },
    consent: {
      heading: "Einwilligung des Beraters",
      description:
        "Überprüfen Sie den Einwilligungsstatus, verfolgen Sie Änderungen und verwalten Sie bei Bedarf Legal-Hold-Ausnahmen.",
      statusLabel: "Aktueller Status",
      status: {
        granted: "Erteilt",
        revoked: "Widerrufen",
        pending: "Ausstehend"
      },
      updateButton: "Änderungen speichern",
      noteLabel: "Notizen",
      languagePreferenceLabel: "Bevorzugte Sprache",
      policyVersionLabel: "Richtlinienversion",
      legalHoldLabel: "Legal Hold",
      legalHoldActive: "Aktiv",
      legalHoldInactive: "Inaktiv",
      historyTitle: "Einwilligungsverlauf",
      historyEmpty: "Es wurden noch keine Änderungen an der Einwilligung protokolliert.",
      lastUpdated: "Zuletzt aktualisiert",
      consentedAt: "Einwilligung erteilt",
      revokedAt: "Widerrufen am",
      updatedBy: "Geändert von",
      languagePlaceholder: "z. B. de-DE",
      notePlaceholder: "Optionalen Grund für die Änderung hinzufügen",
      toastSuccess: "Einwilligungspräferenzen gespeichert",
      toastError: "Aktualisierung der Einwilligungspräferenzen fehlgeschlagen"
    }
  }
};

export function getDictionary(locale: string | null | undefined): Messages {
  if (!locale) {
    return dictionaries[defaultLocale];
  }

  const normalized = locale.split("-")[0].toLowerCase();
  const match = locales.find((candidate) => candidate === normalized);
  if (match) {
    return dictionaries[match];
  }

  return dictionaries[defaultLocale];
}

export function createTranslator(messages: Messages) {
  return (key: string): string => {
    const segments = key.split(".");
    let value: unknown = messages;
    for (const segment of segments) {
      if (typeof value !== "object" || value === null || !(segment in value)) {
        return key;
      }
      value = (value as Record<string, unknown>)[segment];
    }

    if (typeof value === "string") {
      return value;
    }

    return key;
  };
}
