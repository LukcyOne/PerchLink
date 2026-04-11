import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { DEFAULT_LOCALE, LocaleProvider } from '@perchlink/i18n';
import { AppRoutes } from './routes/AppRoutes';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Missing #root mount element for the web app.');
}

createRoot(container).render(
  <React.StrictMode>
    <LocaleProvider initialLocale={DEFAULT_LOCALE}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </LocaleProvider>
  </React.StrictMode>,
);
