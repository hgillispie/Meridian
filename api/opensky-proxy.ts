/**
 * OpenSky Network proxy (Vercel Edge Function).
 *
 * OpenSky migrated to OAuth2 client-credentials in 2024. This proxy
 * exchanges `OPENSKY_CLIENT_ID` + `OPENSKY_CLIENT_SECRET` for a bearer
 * token against Keycloak, caches the token for its lifetime (typically
 * ~30 minutes), then forwards the original query to `/api/states/all`.
 *
 * Falls back to anonymous (unauthenticated) requests if no client
 * credentials are configured; those are rate-limited to ~400 credits/day.
 *
 * Overload protection: Vercel Edge Functions hard-stop at 25 s. OpenSky
 * can sit idle-connected well past a fetch abort signal when they're
 * overloaded, so we enforce an overall handler deadline well under that.
 *
 * Docs: https://openskynetwork.github.io/opensky-api/rest.html
 */

export const config = {
  runtime: 'edge',
};

const STATES_URL = 'https://opensky-network.org/api/states/all';
const TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

// Timeouts, all well below Vercel's 25 s edge cap.
const TOKEN_FETCH_MS = 4_000;
const UPSTREAM_FETCH_MS = 9_000;
const HANDLER_DEADLINE_MS = 12_000;

// If OpenSky (or Keycloak) is overloaded, back off for this long on the
// warm isolate. Long enough that repeat retries can't pile up, short
// enough that recovery shows up within a reasonable client session.
const OVERLOAD_BACKOFF_MS = 90_000;
const TOKEN_FAILURE_BACKOFF_MS = 60_000;

// Module-scope cache — warm Edge isolates reuse this until the token expires.
// expiresAt is a unix-ms timestamp with a 60-second safety margin already
// baked in so we never send a token that the upstream is about to reject.
let cachedToken: { value: string; expiresAt: number } | null = null;

// Skip trying Keycloak while we know the last exchange failed recently.
let tokenFailedUntil = 0;

// Skip even attempting the upstream while it's known-overloaded.
let overloadedUntil = 0;

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number
): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  return fetch(url, { ...init, signal: ac.signal }).finally(() =>
    clearTimeout(timer)
  );
}

/** Reject after `ms` regardless of what the underlying promise is doing. */
function withDeadline<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`deadline: ${label}`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;
  if (now < tokenFailedUntil) return null;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  let res: Response;
  try {
    res = await fetchWithTimeout(
      TOKEN_URL,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      },
      TOKEN_FETCH_MS
    );
  } catch (err) {
    tokenFailedUntil = now + TOKEN_FAILURE_BACKOFF_MS;
    throw err;
  }

  if (!res.ok) {
    tokenFailedUntil = now + TOKEN_FAILURE_BACKOFF_MS;
    const text = await res.text().catch(() => '');
    throw new Error(`OpenSky token exchange failed: ${res.status} ${text}`);
  }
  const payload = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    value: payload.access_token,
    expiresAt: now + (payload.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=5, s-maxage=5',
    },
  });
}

async function runHandler(req: Request): Promise<Response> {
  const now = Date.now();

  // Short-circuit while OpenSky is known-overloaded so we don't burn
  // Edge minutes waiting on hanging upstream connections.
  if (now < overloadedUntil) {
    return json(503, {
      time: Math.floor(now / 1000),
      states: null,
      upstreamOverloaded: true,
    });
  }

  const url = new URL(req.url);
  const upstream = new URL(STATES_URL);
  url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

  const headers: Record<string, string> = {
    'user-agent': 'Meridian/0.1 (+https://github.com/hgillispie/Meridian)',
    accept: 'application/json',
  };

  try {
    const token = await getAccessToken();
    if (token) headers.authorization = `Bearer ${token}`;
  } catch (err) {
    // Token fetch failed — log and fall back to anonymous so a transient
    // Keycloak issue doesn't kill the proxy outright. Anonymous
    // requests still return some data at a lower rate limit.
    console.warn('[opensky-proxy] token exchange failed', err);
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      upstream.toString(),
      { headers },
      UPSTREAM_FETCH_MS
    );
  } catch (err) {
    console.warn('[opensky-proxy] upstream fetch failed', err);
    overloadedUntil = Date.now() + OVERLOAD_BACKOFF_MS;
    return json(504, {
      time: Math.floor(Date.now() / 1000),
      states: null,
      upstreamTimeout: true,
    });
  }

  // OpenSky's overload signal: 500 status with `{ overloaded: true }` body.
  // Mark the isolate as overloaded so we stop hammering them, and return
  // an empty payload the client can tolerate.
  if (res.status >= 500) {
    overloadedUntil = Date.now() + OVERLOAD_BACKOFF_MS;
    return json(503, {
      time: Math.floor(Date.now() / 1000),
      states: null,
      upstreamStatus: res.status,
    });
  }

  // 429 — rate-limited. Back off for the overload window so the client
  // doesn't keep spamming us while the credit bucket refills.
  if (res.status === 429) {
    overloadedUntil = Date.now() + OVERLOAD_BACKOFF_MS;
    return json(429, {
      time: Math.floor(Date.now() / 1000),
      states: null,
      rateLimited: true,
    });
  }

  const resHeaders = new Headers();
  resHeaders.set(
    'content-type',
    res.headers.get('content-type') ?? 'application/json'
  );
  // 5-second cache — matches the client poll cadence so we don't spam OpenSky
  resHeaders.set('cache-control', 'public, max-age=5, s-maxage=5');

  return new Response(res.body, {
    status: res.status,
    headers: resHeaders,
  });
}

export default async function handler(req: Request): Promise<Response> {
  try {
    return await withDeadline(runHandler(req), HANDLER_DEADLINE_MS, 'handler');
  } catch (err) {
    // Anything escaping the inner runHandler (deadline, unexpected throw)
    // gets absorbed into an empty 503 so the client's query gracefully
    // shows zero aircraft rather than erroring out of the whole layer.
    console.warn('[opensky-proxy] handler error', err);
    overloadedUntil = Date.now() + OVERLOAD_BACKOFF_MS;
    return json(503, {
      time: Math.floor(Date.now() / 1000),
      states: null,
      handlerDeadline: true,
    });
  }
}
