import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { getStoredLocale, setStoredLocale } from '@perchlink/store';
import { DEFAULT_LOCALE, ensureI18n, isSupportedLocale, i18nInstance, type SupportedLocale } from './config';
import { LocaleContext } from './useLocale';

interface LocaleProviderProps {
  children: ReactNode;
  initialLocale?: SupportedLocale;
}

function resolveInitialLocale(initialLocale?: SupportedLocale): SupportedLocale {
  if (initialLocale && isSupportedLocale(initialLocale)) {
    return initialLocale;
  }

  const stored = getStoredLocale();

  if (stored && isSupportedLocale(stored)) {
    return stored;
  }

  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children, initialLocale }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => resolveInitialLocale(initialLocale));
  const [ready, setReady] = useState<boolean>(i18nInstance.isInitialized);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    void ensureI18n(locale).then(() => {
      if (!cancelled) {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  const contextValue = useMemo(
    () => ({
      locale,
      setLocale: async (nextLocale: SupportedLocale) => {
        setStoredLocale(nextLocale);
        setLocaleState(nextLocale);
      },
    }),
    [locale],
  );

  if (!ready) {
    return null;
  }

  return (
    <LocaleContext.Provider value={contextValue}>
      <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>
    </LocaleContext.Provider>
  );
}
