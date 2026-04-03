export const DEFAULT_UI_LOCALE = 'zh-CN';
export const SUPPORTED_UI_LOCALES = ['zh-CN', 'en-US'] as const;
export type SupportedUiLocale = (typeof SUPPORTED_UI_LOCALES)[number];
export const UI_LOCALE_STORAGE_KEY = 'perchlink.ui.locale';

function isSupportedUiLocale(value: string): value is SupportedUiLocale {
  return SUPPORTED_UI_LOCALES.includes(value as SupportedUiLocale);
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function getStoredLocale(): SupportedUiLocale | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  const value = storage.getItem(UI_LOCALE_STORAGE_KEY);

  if (value && isSupportedUiLocale(value)) {
    return value;
  }

  return null;
}

export function setStoredLocale(locale: SupportedUiLocale) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(UI_LOCALE_STORAGE_KEY, locale);
}

export function resolveLocalePreference(candidate: string | null | undefined): SupportedUiLocale {
  if (candidate && isSupportedUiLocale(candidate)) {
    return candidate;
  }

  return DEFAULT_UI_LOCALE;
}
