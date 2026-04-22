import { useEffect, useRef } from 'react';
import { useCesium } from 'resium';
import {
  ImageryLayer,
  UrlTemplateImageryProvider,
  type ImageryLayer as CesiumImageryLayer,
} from 'cesium';
import { useLayerStore } from '@/store/layers';
import { useRainviewer } from '@/hooks/useRainviewer';
import { buildTileUrlTemplate } from '@/lib/api/rainviewer';

/**
 * Global precipitation-radar overlay powered by RainViewer.
 *
 * The imagery is added as a *second* layer on top of the base imagery
 * (Bing / Google 3D Tiles) so the basemap stays fully lit underneath.
 * Layer alpha follows the LeftRail intensity slider; when the user
 * disables the layer the ImageryLayer is removed outright to free
 * the tile-cache pressure.
 */
export function WeatherLayer() {
  const enabled = useLayerStore((s) => s.layers.weather.enabled);
  const intensity = useLayerStore((s) => s.layers.weather.intensity);
  const { viewer } = useCesium();
  const { manifest } = useRainviewer(enabled);
  const layerRef = useRef<CesiumImageryLayer | null>(null);

  // Add / replace the imagery layer whenever the latest frame changes.
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    if (!enabled || !manifest) {
      if (layerRef.current) {
        viewer.scene.imageryLayers.remove(layerRef.current, true);
        layerRef.current = null;
      }
      return;
    }

    const frames = manifest.radar.past;
    const latest = frames[frames.length - 1];
    if (!latest) return;

    const url = buildTileUrlTemplate(manifest.host, latest, {
      size: 256,
      color: 4, // TWC vibrant — reads well on the dark Meridian basemap
      smooth: true,
      snow: true,
    });

    const provider = new UrlTemplateImageryProvider({
      url,
      maximumLevel: 7, // RainViewer tiles don't exist deeper than z=7
      credit: 'Weather © RainViewer',
    });
    const layer = new ImageryLayer(provider, { alpha: intensity });

    // Replace any prior layer atomically so we don't flash an empty globe.
    const prior = layerRef.current;
    viewer.scene.imageryLayers.add(layer);
    layerRef.current = layer;
    if (prior) viewer.scene.imageryLayers.remove(prior, true);

    return () => {
      if (layerRef.current === layer) {
        viewer.scene.imageryLayers.remove(layer, true);
        layerRef.current = null;
      }
    };
  }, [viewer, enabled, manifest]);

  // Alpha slider — cheap to toggle without swapping the provider.
  useEffect(() => {
    if (layerRef.current) layerRef.current.alpha = intensity;
  }, [intensity]);

  return null;
}
