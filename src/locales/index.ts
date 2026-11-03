import { useCallback } from "react";
import { en } from "@/locales/en";
import { ru, type TranslationKey } from "@/locales/ru";
import { useSettingsStore } from "@/stores/settings";
import type { Language } from "@/types/app";

export const dictionaries: Record<Language, Record<TranslationKey, string>> = { ru, en };

export function translate(language: Language, key: TranslationKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[language][key] ?? dictionaries.ru[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, variable: string) => {
    const value = vars[variable];
    return value === undefined ? match : String(value);
  });
}

export function useI18n() {
  const language = useSettingsStore((state) => state.settings.language);
  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(language, key, vars),
    [language],
  );
  return { t, language };
}

export type { TranslationKey };
