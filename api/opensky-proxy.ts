/**
 * OpenSky Network proxy (Vercel Edge Function).
 *
 * Forwards query parameters to `/api/states/all` on OpenSky, optionally
 * adding HTTP Basic auth derived from `OPENSKY_USERNAME` + `OPENSKY_PASSWORD`
 * env vars. Anonymous requests are rate-limited to 400 credits/day; an
 * authenticated account raises the limit to 4000.
 *
 * Docs: https://openskynetwork.github.io/opensky-api/rest.html
 */

export const config = {
  runtime: 'edge',
};

const UPSTREAM = 'https://opensky-network.org/api/states/all';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const upstream = new URL(UPSTREAM);
  for (const [k, v] of url.searchParams.entries()) upstream.searchParams.set(k, v);

  const username = process.env.OPENSKY_USERNAME;
  const password = process.env.OPENSKY_PASSWORD;
  const headers: Record<string, string> = {
    'user-agent': 'Meridian/0.1 (+https://github.com/hgillispie/Meridian)',
    accept: 'application/json',
  };
  if (username && password) {
    headers.authorization = `Basic ${btoa(`${username}:${password}`)}`;
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
