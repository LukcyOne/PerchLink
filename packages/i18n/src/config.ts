import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './resources/zh-CN';
import enUS from './resources/en-US';

export const DEFAULT_LOCALE = 'zh-CN';
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const resources = {
  'zh-CN': { translation: zhCN },
  'en-US': { translation: enUS },
} as const;

export function isSupportedLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

export const i18nInstance = i18next.createInstance();

export async function ensureI18n(locale: SupportedLocale = DEFAULT_LOCALE) {
  if (!i18nInstance.isInitialized) {
    await i18nInstance.use(initReactI18next).init({
      resources,
      lng: locale,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: [...SUPPORTED_LOCALES],
      returnNull: false,
      returnEmptyString: false,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
    return i18nInstance;
  }

  if (i18nInstance.language !== locale) {
    await i18nInstance.changeLanguage(locale);
  }

  return i18nInstance;
}
