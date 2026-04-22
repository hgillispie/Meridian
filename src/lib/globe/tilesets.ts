import {
  Cesium3DTileset,
  IonResource,
  type Viewer,
} from 'cesium';

/**
 * Altitude (m) above which Google 3D Tiles are hidden entirely. At wide
 * zoom the Bing imagery + Cesium terrain are indistinguishable from the
 * photorealistic tileset, so we gate the expensive request stream by
 * camera altitude. Threshold picked to match a regional view (~Southeast
 * Asia filling the screen).
 */
export const TILESET_HIDE_ALTITUDE_M = 1_500_000;

/**
 * Cesium SSE target. Higher = coarser tiles = fewer requests. Cesium's
 * default is 16, which is gorgeous but floods the API. 28 still reads as
 * photorealistic at presenter distances and cuts tile volume ~2-3x.
 */
const SCREEN_SPACE_ERROR = 28;

/**
 * GPU cache budget in bytes. Tiles beyond this get evicted LRU-style.
 * 512 MB is aggressive but safe on laptops with discrete GPUs; drop to
 * 256 MB if you start seeing allocation failures in the console.
 */
const CACHE_BYTES = 512 * 1024 * 1024;

/**
 * Apply Meridian's perf-focused tileset tuning. Called for every resolution
 * branch below so Google / Ion / fallback all share the same cache + SSE.
 */
function tuneTileset(tileset: Cesium3DTileset): void {
  tileset.maximumScreenSpaceError = SCREEN_SPACE_ERROR;
  // `cacheBytes` + `maximumCacheOverflowBytes` replace the deprecated
  // `maximumMemoryUsage`. Overflow is allowed during camera motion; the
  // cache trims back down once the camera settles.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (tileset as unknown as { cacheBytes?: number }).cacheBytes = CACHE_BYTES;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (tileset as unknown as { maximumCacheOverflowBytes?: number }).maximumCacheOverflowBytes =
    CACHE_BYTES / 2;
  // Warm the cache for a camera fly destination so we don't shotgun the
  // tile server on landing.
  tileset.preloadFlightDestinations = true;
  // Never fetch tiles for the far side of the globe we're not looking at.
  tileset.preloadWhenHidden = false;
  // Never retain tiles we can no longer see.
  tileset.cullRequestsWhileMoving = true;
  tileset.cullRequestsWhileMovingMultiplier = 10;
}

/**
 * Load the best-available world tileset onto the Cesium viewer.
 *
 * Resolution order:
 *   1. Google Photorealistic 3D Tiles via dev key         (pnpm dev convenience)
 *   2. Google Photorealistic 3D Tiles via /api/tiles-proxy (Vercel prod/preview)
 *   3. Cesium Ion OSM Buildings (free asset 96188)         (fallback)
 *   4. No tileset — Bing imagery + terrain only            (last resort)
 */
export async function loadWorldTileset(viewer: Viewer): Promise<Cesium3DTileset | null> {
  const devKey = import.meta.env.VITE_PUBLIC_GOOGLE_TILES_DEV_KEY as string | undefined;
  const hasProxy = import.meta.env.VITE_PUBLIC_HAS_GOOGLE_TILES === 'true';
  const ionToken = import.meta.env.VITE_PUBLIC_CESIUM_ION_TOKEN as string | undefined;

  // 1. Direct Google key (dev only — never set in production)
  if (devKey) {
    const loaded = await tryLoad(
      viewer,
      `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(devKey)}`,
      'Google 3D Tiles (dev key)'
    );
    if (loaded) return loaded;
  }

  // 2. Production proxy (Vercel edge function attaches the key server-side)
  if (hasProxy) {
    const loaded = await tryLoad(viewer, '/api/tiles-proxy', 'Google 3D Tiles (proxy)');
    if (loaded) return loaded;
  }

  // 3. Cesium Ion OSM Buildings — free tier friendly, globally covers buildings
  if (ionToken) {
    try {
      const resource = await IonResource.fromAssetId(96188);
      const tileset = await Cesium3DTileset.fromUrl(resource, {
        showCreditsOnScreen: true,
      });
      tuneTileset(tileset);
      viewer.scene.primitives.add(tileset);
      return tileset;
    } catch (err) {
      console.warn('[Meridian] Cesium Ion OSM Buildings load failed', err);
    }
  } else {
    console.info(
      '[Meridian] No tileset sources configured. Add VITE_PUBLIC_CESIUM_ION_TOKEN or ' +
        'VITE_PUBLIC_GOOGLE_TILES_DEV_KEY to .env.local, or deploy /api/tiles-proxy ' +
        'with GOOGLE_MAPS_3D_TILES_KEY set.'
    );
  }

  // 4. No 3D tileset — imagery + terrain only
  return null;
}

async function tryLoad(
  viewer: Viewer,
  url: string,
  label: string
): Promise<Cesium3DTileset | null> {
  try {
    const tileset = await Cesium3DTileset.fromUrl(url, {
      showCreditsOnScreen: true,
    });
    tuneTileset(tileset);
    viewer.scene.primitives.add(tileset);
    console.info(`[Meridian] Loaded ${label}`);
    return tileset;
  } catch (err) {
    console.warn(`[Meridian] Failed to load ${label}:`, err);
    return null;
  }
}

/**
 * Hide the tileset when the camera is far enough out that Bing imagery
 * is indistinguishable from 3D Tiles, and show it again on zoom-in.
 * Returns a cleanup fn that removes the camera listener.
 */
export function installAltitudeGate(
  viewer: Viewer,
  tileset: Cesium3DTileset,
  hideAbove = TILESET_HIDE_ALTITUDE_M
): () => void {
  const update = () => {
    const carto = viewer.camera.positionCartographic;
    if (!carto) return;
    const shouldShow = carto.height < hideAbove;
    if (tileset.show !== shouldShow) {
      tileset.show = shouldShow;
    }
  };
  // Initial check + subscribe to camera moves
  update();
  const remove = viewer.camera.changed.addEventListener(update);
  return () => remove();
}
