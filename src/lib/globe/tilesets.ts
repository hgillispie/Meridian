import {
  Cesium3DTileset,
  Ion,
  IonResource,
  type Viewer,
} from 'cesium';

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

  if (ionToken) {
    Ion.defaultAccessToken = ionToken;
  }

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
    viewer.scene.primitives.add(tileset);
    console.info(`[Meridian] Loaded ${label}`);
    return tileset;
  } catch (err) {
    console.warn(`[Meridian] Failed to load ${label}:`, err);
    return null;
  }
}
