import { Text } from '@mantine/core';

/**
 * Data-source attribution overlay (§9 Phase 9 audit prerequisite, but
 * shown from day one so we never ship without it).
 *
 * Google 3D Tiles ToS requires visible attribution whenever the tileset
 * is rendered. Cesium also renders its own credit bar, but we place a
 * permanent dim line here so it's never missed.
 */
export function Attribution() {
  return (
    <Text
      size="10px"
      c="dimmed"
      ff="monospace"
      data-mono
      style={{
        position: 'absolute',
        bottom: 4,
        left: 12,
        zIndex: 10,
        pointerEvents: 'none',
        opacity: 0.7,
        letterSpacing: '0.04em',
      }}
    >
      Data · Google 3D Tiles · Cesium Ion · AISStream · OpenSky · CelesTrak · NOAA · Open-Meteo
    </Text>
  );
}
