import { Box } from '@mantine/core';
import { Globe } from './Globe';
import { Attribution } from './Attribution';

/**
 * Full-bleed container that hosts the Cesium Viewer and any globe-level
 * overlays (attribution, loading veil). Layer entity components mount
 * inside <Globe> via Resium.
 */
export function GlobeStage() {
  return (
    <Box
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#020305',
        overflow: 'hidden',
      }}
    >
      <Globe />
      <Attribution />
    </Box>
  );
}
