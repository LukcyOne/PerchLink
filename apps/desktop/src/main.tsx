import React from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_LOCALE, LocaleProvider } from '@perchlink/i18n';
import { AppRoutes } from './routes/AppRoutes';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Missing #root mount element for the desktop app.');
}

createRoot(container).render(
  <React.StrictMode>
    <LocaleProvider initialLocale={DEFAULT_LOCALE}>
      <AppRoutes />
    </LocaleProvider>
  </React.StrictMode>,
);
