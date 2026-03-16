export type SafeClawLocale = "zh-CN" | "en";

export const DEFAULT_SAFECLAW_LOCALE: SafeClawLocale = "en";

function normalizeLocaleTag(value: string): string {
  return value.trim().replace(/_/g, "-").toLowerCase();
}

export function resolveSafeClawLocale(
  value: string | undefined,
  fallback: SafeClawLocale = DEFAULT_SAFECLAW_LOCALE,
): SafeClawLocale {
  const normalized = value ? normalizeLocaleTag(value) : "";
  if (!normalized) {
    return fallback;
  }
  if (normalized === "zh" || normalized.startsWith("zh-")) {
    return "zh-CN";
  }
  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en";
  }
  return fallback;
}

export function isChineseLocale(locale: SafeClawLocale): boolean {
  return locale === "zh-CN";
}

export function localeForIntl(locale: SafeClawLocale): string {
  return isChineseLocale(locale) ? "zh-CN" : "en-US";
}

export function pickLocalized(locale: SafeClawLocale, zhText: string, enText: string): string {
  return isChineseLocale(locale) ? zhText : enText;
}
