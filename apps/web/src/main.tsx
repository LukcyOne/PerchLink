import React from 'react';
import { createRoot } from 'react-dom/client';

function WebAppHost() {
  return (
    <main data-app-surface="web">
      <h1>PerchLink</h1>
      <p>Shared shell host for the web surface.</p>
    </main>
  );
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Missing #root mount element for the web app.');
}

createRoot(container).render(
  <React.StrictMode>
    <WebAppHost />
  </React.StrictMode>,
);
