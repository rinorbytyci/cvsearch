import Link from "next/link";

import { createTranslator, getDictionary } from "@/i18n/config";
import { resolveRequestLocale } from "@/i18n/server";

export default function ConsultantsPage() {
  const locale = resolveRequestLocale();
  const messages = getDictionary(locale);
  const t = createTranslator(messages);

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: "48rem" }}>
      <h2>{t("consent.heading")}</h2>
      <p>{t("consent.description")}</p>
      <p>
        <Link href="/consultants/demo/consent" style={{ textDecoration: "underline" }}>
          /consultants/&lt;consultantId&gt;/consent
        </Link>
      </p>
    </section>
  );
}
