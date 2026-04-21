import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Ion } from 'cesium';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/charts/styles.css';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './styles/globals.css';
import './styles/tokens.css';
import { App } from './App';

// Set the Cesium Ion access token BEFORE any Viewer mounts, otherwise the
// first Bing-imagery request fires with the built-in demo token and Cesium
// overlays the "default access token" watermark for the rest of the session.
const ionToken = import.meta.env.VITE_PUBLIC_CESIUM_ION_TOKEN as string | undefined;
if (ionToken) {
  Ion.defaultAccessToken = ionToken;
} else {
  console.warn(
    '[Meridian] VITE_PUBLIC_CESIUM_ION_TOKEN not set — Cesium will show a ' +
      'default-token watermark. Add it to .env.local.'
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
