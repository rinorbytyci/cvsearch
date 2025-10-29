import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { createTranslator, getDictionary } from "@/i18n/config";
import { I18nProvider } from "@/i18n/provider";
import { resolveRequestLocale } from "@/i18n/server";

export const metadata: Metadata = {
  title: "CV Search",
  description: "AI-assisted resume search platform"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const locale = resolveRequestLocale();
  const messages = getDictionary(locale);
  const t = createTranslator(messages);
  const languageLabelKey = locale === "de" ? "common.language.german" : "common.language.english";
  const languageDisplay = `${t("common.language.label")}: ${t(languageLabelKey)}`;

  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale} messages={messages}>
          <header>
            <nav
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem"
              }}
            >
              <h1>{t("common.appName")}</h1>
              <ul
                style={{
                  display: "flex",
                  gap: "1rem",
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  alignItems: "center"
                }}
              >
                <li>
                  <a href="/search">{t("common.nav.search")}</a>
                </li>
                <li>
                  <a href="/searches">{t("common.nav.savedSearches")}</a>
                </li>
                <li>
                  <a href="/consultants">{t("common.nav.consent")}</a>
                </li>
                <li>
                  <small>{languageDisplay}</small>
                </li>
              </ul>
            </nav>
          </header>
          <main>{children}</main>
          <footer>
            <small>&copy; {new Date().getFullYear()} {t("common.footer")}</small>
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
