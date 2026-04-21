import { Box, Stack, Text, Loader } from '@mantine/core';

/**
 * Phase 0 placeholder for the 3D globe. Phase 1 replaces this with
 * the Resium `<Viewer>` + Google 3D Tiles. Styled to signal
 * "globe is loading" without actually mounting Cesium yet.
 */
export function GlobeStage() {
  return (
    <Box
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background:
          'radial-gradient(ellipse at center, #0b1220 0%, #050709 70%, #050709 100%)',
        overflow: 'hidden',
      }}
    >
      <OrbitBackdrop />
      <Stack
        align="center"
        justify="center"
        gap="sm"
        style={{
          position: 'absolute',
          inset: 0,
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <Loader size="sm" color="meridian" type="dots" />
        <Text size="sm" c="dimmed" ff="monospace" data-mono>
          GLOBE · phase 1
        </Text>
        <Text size="xs" c="dimmed" maw={320}>
          Phase 0 scaffold is live. Resium + Google Photorealistic 3D Tiles mount here in
          Phase 1.
        </Text>
      </Stack>
    </Box>
  );
}

function OrbitBackdrop() {
  return (
    <svg
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18 }}
      aria-hidden
    >
      <defs>
        <radialGradient id="g" cx="50%" cy="50%" r="40%">
          <stop offset="0%" stopColor="#00E5A8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#00E5A8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="400" cy="300" r="200" fill="url(#g)" />
      <circle cx="400" cy="300" r="200" fill="none" stroke="#00E5A8" strokeWidth="0.5" />
      <ellipse
        cx="400"
        cy="300"
        rx="260"
        ry="100"
        fill="none"
        stroke="#7BD3FF"
        strokeWidth="0.5"
        opacity="0.7"
      />
      <ellipse
        cx="400"
        cy="300"
        rx="320"
        ry="60"
        fill="none"
        stroke="#7BD3FF"
        strokeWidth="0.5"
        opacity="0.5"
      />
      <line x1="80" y1="300" x2="720" y2="300" stroke="#00E5A8" strokeWidth="0.3" />
      <line x1="400" y1="80" x2="400" y2="520" stroke="#00E5A8" strokeWidth="0.3" />
    </svg>
  );
}
