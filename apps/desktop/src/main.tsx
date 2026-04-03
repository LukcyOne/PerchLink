import React from 'react';
import { createRoot } from 'react-dom/client';

function DesktopAppHost() {
  return (
    <main data-app-surface="desktop">
      <h1>PerchLink</h1>
      <p>Shared shell host for the desktop surface.</p>
    </main>
  );
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Missing #root mount element for the desktop app.');
}

createRoot(container).render(
  <React.StrictMode>
    <DesktopAppHost />
  </React.StrictMode>,
);
