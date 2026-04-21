/**
 * Vercel Edge Function — Google Photorealistic 3D Tiles key proxy.
 *
 * Incoming request:  /api/tiles-proxy          → tileset root.json
 *                    /api/tiles-proxy/path...  → child tile / resource
 *
 * The Google API key lives only in server env (`GOOGLE_MAPS_3D_TILES_KEY`)
 * and is appended to the upstream URL before the request leaves the edge.
 *
 * Deploy: Vercel auto-detects this file under /api/ and builds it as an
 * Edge Function. Client-facing requests hit /api/tiles-proxy(/…).
 */

export const config = {
  runtime: 'edge',
};

const GOOGLE_BASE = 'https://tile.googleapis.com/v1/3dtiles';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const key = process.env.GOOGLE_MAPS_3D_TILES_KEY;

  if (!key) {
    return new Response(
      JSON.stringify({
        error: 'GOOGLE_MAPS_3D_TILES_KEY not configured on server',
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }

  // Map local path: /api/tiles-proxy[/extra]  →  /v1/3dtiles/root.json or /v1/3dtiles/extra
  const subpath = url.pathname.replace(/^\/api\/tiles-proxy/, '');
  const upstreamPath = subpath && subpath !== '/' ? subpath : '/root.json';
  const upstream = new URL(`${GOOGLE_BASE}${upstreamPath}`);

  // Preserve incoming query params (Google uses `session` etc.) then add key
  for (const [k, v] of url.searchParams.entries()) upstream.searchParams.set(k, v);
  upstream.searchParams.set('key', key);

  const upstreamRes = await fetch(upstream.toString(), {
    headers: {
      // Google requires a user-agent; browsers set one automatically but edge
      // runtime may not.
      'user-agent': 'Meridian/0.1 (+https://github.com/hgillispie/Meridian)',
    },
  });

  // Stream through, preserving content-type + caching headers. Strip the
  // key out of any redirect `Location` headers just in case.
  const headers = new Headers(upstreamRes.headers);
  headers.delete('set-cookie');
  headers.set('cache-control', 'public, max-age=3600, s-maxage=86400');

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers,
  });
}
