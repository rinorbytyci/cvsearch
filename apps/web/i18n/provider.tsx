"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import type { Locale, Messages } from "./config";
import { createTranslator } from "./config";

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const translator = useMemo(() => createTranslator(messages), [messages]);
  const value = useMemo<I18nContextValue>(() => ({ locale, messages, t: translator }), [locale, messages, translator]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }

  return context;
}
