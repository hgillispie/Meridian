/**
 * Ambient declaration for the handful of Node/Edge globals the proxies
 * use. We keep `@types/node` out of the api tsconfig because these
 * Edge Functions run in a browser-like runtime — the full Node lib
 * surface would mislead editor intellisense. `process.env` is the one
 * Vercel guarantees at runtime.
 */
declare const process: {
  env: Record<string, string | undefined>;
};
