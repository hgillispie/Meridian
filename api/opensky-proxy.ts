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
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
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

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const upstream = new URL(STATES_URL);
  for (const [k, v] of url.searchParams.entries()) upstream.searchParams.set(k, v);

  const headers: Record<string, string> = {
    'user-agent': 'Meridian/0.1 (+https://github.com/hgillispie/Meridian)',
    accept: 'application/json',
  };

  try {
    const token = await getAccessToken();
    if (token) headers.authorization = `Bearer ${token}`;
  } catch (err) {
    // Token fetch failed — log and fall back to anonymous so the proxy
    // isn't fully dead when creds rotate.
    console.error('[opensky-proxy]', err);
  }

  const res = await fetch(upstream.toString(), { headers });

  const resHeaders = new Headers();
  resHeaders.set('content-type', res.headers.get('content-type') ?? 'application/json');
  // 5-second cache — matches the client poll cadence so we don't spam OpenSky
  resHeaders.set('cache-control', 'public, max-age=5, s-maxage=5');

  return new Response(res.body, {
    status: res.status,
    headers: resHeaders,
  });
}
