export const SUPPORTED_LOCALES = ["fr-FR", "en-US", "es-ES"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_OPTIONS: Array<{ value: AppLocale; label: string }> = [
  { value: "fr-FR", label: "Français" },
  { value: "en-US", label: "English" },
  { value: "es-ES", label: "Español" },
];

const LOCALE_ALIASES: Record<string, AppLocale> = {
  fr: "fr-FR",
  "fr-fr": "fr-FR",
  en: "en-US",
  "en-us": "en-US",
  es: "es-ES",
  "es-es": "es-ES",
};

export function normalizeAppLocale(locale: string | null | undefined): AppLocale {
  if (!locale) return "fr-FR";

  const normalized = locale.trim().toLowerCase();
  if (LOCALE_ALIASES[normalized]) {
    return LOCALE_ALIASES[normalized];
  }

  if (normalized.startsWith("fr-")) return "fr-FR";
  if (normalized.startsWith("en-")) return "en-US";
  if (normalized.startsWith("es-")) return "es-ES";

  return "fr-FR";
}

export function getHtmlLang(locale: string | null | undefined): "fr" | "en" | "es" {
  const normalized = normalizeAppLocale(locale);

  if (normalized === "en-US") return "en";
  if (normalized === "es-ES") return "es";
  return "fr";
}
