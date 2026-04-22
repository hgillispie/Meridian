/**
 * RainViewer — free, keyless global precipitation-radar tile API.
 *
 * The manifest at `weather-maps.json` enumerates the last ~2h of radar
 * snapshots (every 10 minutes) plus short nowcast frames. Each entry has
 * a `path` like `/v2/radar/1728000000` that we append to the host to
 * build a slippy-map tile URL:
 *
 *   `${host}${path}/{size}/{z}/{x}/{y}/{color}/{smooth}_{snow}.png`
 *
 *   size   — 256 or 512
 *   color  — palette index (2 = "Universal Blue", 4 = "TWC" vibrant)
 *   smooth — 1 = bilinear, 0 = nearest
 *   snow   — 1 to visually distinguish snow vs. rain
 *
 * Docs: https://www.rainviewer.com/api.html
 */

const MANIFEST_URL = 'https://api.rainviewer.com/public/weather-maps.json';

export type RadarFrame = {
  time: number;
  path: string;
};

export type RainviewerManifest = {
  version: string;
  generated: number;
  host: string;
  radar: {
    past: RadarFrame[];
    nowcast: RadarFrame[];
  };
};

export async function fetchRainviewerManifest(): Promise<RainviewerManifest> {
  const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`RainViewer manifest HTTP ${res.status}`);
  return (await res.json()) as RainviewerManifest;
}

/**
 * Build a Cesium-compatible URL template for the latest radar frame.
 * `{z}/{x}/{y}` placeholders are left intact for Cesium to substitute.
 */
export function buildTileUrlTemplate(
  host: string,
  frame: RadarFrame,
  opts: { size?: 256 | 512; color?: number; smooth?: boolean; snow?: boolean } = {}
): string {
  const size = opts.size ?? 256;
  const color = opts.color ?? 4; // TWC vibrant — reads well on dark basemap
  const smooth = opts.smooth === false ? 0 : 1;
  const snow = opts.snow === false ? 0 : 1;
  return `${host}${frame.path}/${size}/{z}/{x}/{y}/${color}/${smooth}_${snow}.png`;
}
