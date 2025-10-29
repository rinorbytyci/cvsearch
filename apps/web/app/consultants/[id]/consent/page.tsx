import { cookies } from "next/headers";
import Link from "next/link";

import { createTranslator, getDictionary } from "@/i18n/config";
import { resolveRequestLocale } from "@/i18n/server";
import { ConsentPanel, type ConsentViewModel } from "@/components/consent/ConsentPanel";

async function fetchConsent(consultantId: string): Promise<ConsentViewModel> {
  const cookieHeader = cookies().toString();
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/consultants/${consultantId}/consent`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load consent: ${response.status}`);
  }

  return (await response.json()) as ConsentViewModel;
}

export default async function ConsultantConsentPage({ params }: { params: { id: string } }) {
  const locale = resolveRequestLocale();
  const messages = getDictionary(locale);
  const t = createTranslator(messages);

  let consent: ConsentViewModel | null = null;
  let error: string | null = null;

  try {
    consent = await fetchConsent(params.id);
  } catch (exception) {
    console.error("Unable to fetch consent", exception);
    error = t("consent.toastError");
  }

  return (
    <section style={{ display: "grid", gap: "1.5rem" }}>
      <header style={{ display: "grid", gap: "0.5rem" }}>
        <h2>{t("consent.heading")}</h2>
        <p>{t("consent.description")}</p>
        <Link href="/consultants" style={{ textDecoration: "underline" }}>
          &larr; {t("common.nav.consent")}
        </Link>
      </header>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {consent ? <ConsentPanel consultantId={params.id} initialConsent={consent} /> : null}
    </section>
  );
}
