import { Stack, Text, Group, Paper, RingProgress, Box, UnstyledButton } from '@mantine/core';
import { useLiveDataStore } from '@/store/liveData';
import { useSatelliteStore } from '@/store/satellites';
import { useChokepointStore, type ChokepointId } from '@/store/chokepoints';
import { useEventsStore } from '@/store/events';
import { useSelectionStore } from '@/store/selection';
import { flyTo } from '@/lib/globe/cameraApi';

/**
 * Default right-rail card when nothing is selected (§6.1).
 * Live feed counts are pulled from their respective zustand stores so the
 * numbers tick with the actual entity streams.
 */
export function OverviewCard() {
  const vesselCount = useLiveDataStore((s) => Object.keys(s.vessels).length);
  const aircraftCount = useLiveDataStore((s) => Object.keys(s.aircraft).length);
  const satelliteCount = useSatelliteStore((s) => Object.keys(s.byId).length);
  const eventCount = useEventsStore((s) => s.events.length);
  const chokepointFeatures = useChokepointStore((s) => s.features);
  const chokepointMetrics = useChokepointStore((s) => s.metrics);
  const chokepointBaselines = useChokepointStore((s) => s.baselines);
  const select = useSelectionStore((s) => s.select);

  // Show the four hero chokepoints in the overview strip; full list is
  // accessible via spotlight (@choke).
  const HERO_IDS: ChokepointId[] = ['suez', 'panama', 'hormuz', 'malacca'];
  const heroes = HERO_IDS.map((id) => {
    const f = chokepointFeatures.find((x) => x.id === id);
    const m = chokepointMetrics[id];
    const b = chokepointBaselines[id];
    return { id, feature: f, metric: m, baseline: b };
  });

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
        <Stat label="Events" value={eventCount === 0 ? '—' : String(eventCount)} phase="Phase 5" />
      </Group>

      <Paper p="sm" withBorder>
        <Group justify="space-between" mb={6}>
          <Text size="xs" fw={600}>
            Chokepoints
          </Text>
          <Text size="xs" c="meridian">
            Phase 5 · live
          </Text>
        </Group>
        <Stack gap={4}>
          {heroes.map(({ id, feature, metric, baseline }) => {
            const inside = metric?.vesselsInside ?? 0;
            const queue = metric?.queueLength ?? 0;
            const typical = baseline?.typicalQueue ?? 10;
            const pct =
              inside > 0
                ? Math.min(100, Math.round((inside / Math.max(typical * 5, 10)) * 100))
                : 0;
            const color =
              queue > typical * 2
                ? '#F59E0B'
                : queue > typical
                  ? '#FACC15'
                  : 'var(--meridian-accent)';
            return (
              <UnstyledButton
                key={id}
                onClick={() => {
                  if (feature) {
                    select({ kind: 'chokepoint', id });
                    flyTo(feature.center[0], feature.center[1], 1_500_000);
                  }
                }}
                style={{ display: 'block' }}
              >
                <Group justify="space-between" gap="xs">
                  <Text size="xs" c="dimmed">
                    {feature?.name ?? id}
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
                        style={{ background: color }}
                      />
                    </Box>
                    <Text size="xs" c="dimmed" ff="monospace" data-mono>
                      {inside > 0 ? String(inside) : '—'}
                    </Text>
                  </Group>
                </Group>
              </UnstyledButton>
            );
          })}
        </Stack>
      </Paper>

      <Paper p="sm" withBorder>
        <Group justify="space-between" mb={6}>
          <Text size="xs" fw={600}>
            System
          </Text>
          <Text size="xs" c="meridian">
            Phase 5 · live
          </Text>
        </Group>
        <Group justify="space-between">
          <Group gap={8}>
            <RingProgress
              size={40}
              thickness={4}
              sections={[{ value: 70, color: 'meridian' }]}
            />
            <Stack gap={0}>
              <Text size="xs" fw={500}>
                Build progress
              </Text>
              <Text size="xs" c="dimmed">
                7 / 10 phases
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
