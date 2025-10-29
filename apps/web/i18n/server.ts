import { cookies, headers } from "next/headers";

import { defaultLocale, locales, type Locale } from "./config";

export function resolveRequestLocale(): Locale {
  const cookieStore = cookies();
  const cookieLocale = cookieStore.get("locale")?.value;
  if (cookieLocale) {
    const normalized = cookieLocale.split("-")[0].toLowerCase();
    const match = locales.find((locale) => locale === normalized);
    if (match) {
      return match;
    }
  }

  const acceptLanguage = headers().get("accept-language");
  if (acceptLanguage) {
    const preferred = acceptLanguage.split(",")[0]?.trim().toLowerCase();
    if (preferred) {
      const normalized = preferred.split("-")[0];
      const match = locales.find((locale) => locale === normalized);
      if (match) {
        return match;
      }
    }
  }

  return defaultLocale;
}
