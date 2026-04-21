import type { Bbox } from '@/lib/geo/bbox';
import { type Aircraft, fromOpenSky, type OpenSkyRawState } from '@/types/aircraft';

/**
 * OpenSky Network REST client.
 *
 * All requests are routed through `/api/opensky-proxy` so that Basic auth
 * credentials (if configured) stay server-side. The proxy appends the
 * `states/all` path + query automatically.
 */

type OpenSkyResponse = {
  time: number;
  states: OpenSkyRawState[] | null;
};

export async function fetchStatesInBbox(
  bbox: Bbox,
  signal?: AbortSignal
): Promise<Aircraft[]> {
  const params = new URLSearchParams({
    lamin: bbox.south.toFixed(4),
    lomin: bbox.west.toFixed(4),
    lamax: bbox.north.toFixed(4),
    lomax: bbox.east.toFixed(4),
  });

  const res = await fetch(`/api/opensky-proxy?${params.toString()}`, {
    signal,
    headers: { accept: 'application/json' },
  });

  // 503/504 from our proxy means OpenSky is overloaded or timed out —
  // return an empty array so the layer renders cleanly instead of
  // throwing and triggering a TanStack retry storm.
  if (res.status === 503 || res.status === 504) return [];
  if (!res.ok) {
    throw new Error(`OpenSky proxy error ${res.status}`);
  }

  const json = (await res.json()) as OpenSkyResponse;
  if (!json.states) return [];
  return json.states
    .map(fromOpenSky)
    .filter((a): a is Aircraft => a.lon != null && a.lat != null && !a.onGround);
}
