import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';
import path from 'node:path';

/**
 * Dev-only middleware: short-circuit any request to `/api/*` with a 404.
 *
 * Vercel Edge Functions in `/api/*.ts` only run on Vercel. In `pnpm dev`,
 * Vite would otherwise try to resolve the URL path against a file on disk
 * and pipe the Edge Function source through esbuild as a client module,
 * which explodes ("Invalid loader value: 0000"). Intercepting here makes
 * the fetch fail cleanly and keeps the dev server stable.
 */
function blockEdgeFunctionsInDev(): Plugin {
  return {
    name: 'meridian:block-edge-functions-in-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          res.statusCode = 404;
          res.setHeader('content-type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'Edge functions are not available under `pnpm dev`. ' +
                'Run `vercel dev` or test against the Vercel preview.',
            })
          );
          return;
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    cesium(),
    blockEdgeFunctionsInDev(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 2500, // Cesium is intentionally large
  },
});
