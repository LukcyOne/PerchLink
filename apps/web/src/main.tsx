import React from 'react';
import { createRoot } from 'react-dom/client';
import { shellNavigation } from '@perchlink/core';
import { DEFAULT_LOCALE, LocaleProvider, i18nInstance, useLocale } from '@perchlink/i18n';
import { AppShell } from '@perchlink/ui';

function WebShellSurface() {
  const { locale } = useLocale();

  return (
    <AppShell
      navigationItems={shellNavigation}
      activeNavId="all-bookmarks"
      pageTitle={i18nInstance.t('shell.pageTitle', { lng: locale })}
      primaryActionLabel={i18nInstance.t('shell.primaryCta', { lng: locale })}
    >
      <section data-app-surface="web">
        <h2>{i18nInstance.t('shell.emptyStateHeading', { lng: locale })}</h2>
        <p>{i18nInstance.t('shell.surfaceDescription', { lng: locale })}</p>
      </section>
    </AppShell>
  );
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Missing #root mount element for the web app.');
}

createRoot(container).render(
  <React.StrictMode>
    <LocaleProvider initialLocale={DEFAULT_LOCALE}>
      <WebShellSurface />
    </LocaleProvider>
  </React.StrictMode>,
);
