import { Stack, Text, Group, Paper, RingProgress, Box } from '@mantine/core';
import { useLiveDataStore } from '@/store/liveData';
import { useSatelliteStore } from '@/store/satellites';

/**
 * Default right-rail card when nothing is selected (§6.1).
 * Live feed counts are pulled from their respective zustand stores so the
 * numbers tick with the actual entity streams.
 */
export function OverviewCard() {
  const vesselCount = useLiveDataStore((s) => Object.keys(s.vessels).length);
  const aircraftCount = useLiveDataStore((s) => Object.keys(s.aircraft).length);
  const satelliteCount = useSatelliteStore((s) => Object.keys(s.byId).length);

  return (
    <Stack gap="md">
      <Stack gap={2}>
        <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.08em' }}>
          Overview
        </Text>
        <Text size="sm" c="dimmed">
          Select any vessel, aircraft, satellite, or port on the globe for a full briefing.
        </Text>
      </Stack>

      <Group grow gap="xs">
        <Stat label="Vessels" value={formatCount(vesselCount)} phase="Phase 2" />
        <Stat label="Aircraft" value={formatCount(aircraftCount)} phase="Phase 2" />
      </Group>
      <Group grow gap="xs">
        <Stat label="Satellites" value={formatCount(satelliteCount)} phase="Phase 3" />
        <Stat label="Events" value="—" phase="Phase 5" />
      </Group>

      <Paper p="sm" withBorder>
        <Group justify="space-between" mb={6}>
          <Text size="xs" fw={600}>
            Chokepoints
          </Text>
          <Text size="xs" c="dimmed">
            Phase 5
          </Text>
        </Group>
        <Stack gap={4}>
          {[
            ['Suez', 0],
            ['Panama', 0],
            ['Hormuz', 0],
            ['Malacca', 0],
          ].map(([name, pct]) => (
            <Group key={name as string} justify="space-between" gap="xs">
              <Text size="xs" c="dimmed">
                {name}
              </Text>
              <Group gap={4}>
                <Box
                  w={60}
                  h={4}
                  style={{
                    background: 'var(--meridian-border)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    h="100%"
                    w={`${pct}%`}
                    style={{ background: 'var(--meridian-accent)' }}
                  />
                </Box>
                <Text size="xs" c="dimmed" ff="monospace" data-mono>
                  —
                </Text>
              </Group>
            </Group>
          ))}
        </Stack>
      </Paper>

      <Paper p="sm" withBorder>
        <Group justify="space-between" mb={6}>
          <Text size="xs" fw={600}>
            System
          </Text>
          <Text size="xs" c="meridian">
            Phase 0 · live
          </Text>
        </Group>
        <Group justify="space-between">
          <Group gap={8}>
            <RingProgress
              size={40}
              thickness={4}
              sections={[{ value: 40, color: 'meridian' }]}
            />
            <Stack gap={0}>
              <Text size="xs" fw={500}>
                Build progress
              </Text>
              <Text size="xs" c="dimmed">
                4 / 10 phases
              </Text>
            </Stack>
          </Group>
        </Group>
      </Paper>
    </Stack>
  );
}

function formatCount(n: number): string {
  if (n <= 0) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function Stat({ label, value, phase }: { label: string; value: string; phase: string }) {
  return (
    <Paper p="sm" withBorder>
      <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
        {label}
      </Text>
      <Text size="xl" fw={600} ff="monospace" data-mono lh={1.1}>
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {phase}
      </Text>
    </Paper>
  );
}
