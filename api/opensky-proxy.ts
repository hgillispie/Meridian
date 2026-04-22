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
 * Docs: https://openskynetwork.github.io/opensky-api/rest.html
 */

export const config = {
  runtime: 'edge',
};

const STATES_URL = 'https://opensky-network.org/api/states/all';
const TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

// Module-scope cache — warm Edge isolates reuse this until the token expires.
// expiresAt is a unix-ms timestamp with a 60-second safety margin already
// baked in so we never send a token that the upstream is about to reject.
let cachedToken: { value: string; expiresAt: number } | null = null;

// OpenSky's public endpoints occasionally return HTTP 500 with
// `{ "overloaded": true }` under load. When that happens we back off for
// a short window so we don't pile up on them and waste Vercel Edge
// invocations.
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

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetchWithTimeout(
    TOKEN_URL,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    },
    8_000
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenSky token exchange failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: now + (json.expires_in - 60) * 1000,
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

export default async function handler(req: Request): Promise<Response> {
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
    res = await fetchWithTimeout(upstream.toString(), { headers }, 10_000);
  } catch (err) {
    console.warn('[opensky-proxy] upstream fetch failed', err);
    overloadedUntil = Date.now() + 60_000;
    return json(504, {
      time: Math.floor(Date.now() / 1000),
      states: null,
      upstreamTimeout: true,
    });
  }

  // OpenSky's overload signal: 500 status with `{ overloaded: true }` body.
  // Mark the isolate as overloaded for 60s and return an empty payload the
  // client can tolerate.
  if (res.status >= 500) {
    overloadedUntil = Date.now() + 60_000;
    return json(503, {
      time: Math.floor(Date.now() / 1000),
      states: null,
      upstreamStatus: res.status,
    });
  }

  const resHeaders = new Headers();
  resHeaders.set('content-type', res.headers.get('content-type') ?? 'application/json');
  // 5-second cache — matches the client poll cadence so we don't spam OpenSky
  resHeaders.set('cache-control', 'public, max-age=5, s-maxage=5');

  return new Response(res.body, {
    status: res.status,
    headers: resHeaders,
  });
}
