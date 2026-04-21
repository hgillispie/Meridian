import { Paper, Stack, Text } from '@mantine/core';
import type { SelectionKind } from '@/store/selection';

/**
 * Stand-in for VesselCard / AircraftCard / SatelliteCard / PortCard /
 * ChokepointCard — those get built out Phase 2-5.
 */
export function PlaceholderCard({ kind }: { kind: SelectionKind }) {
  return (
    <Paper p="md" withBorder>
      <Stack gap="xs">
        <Text size="xs" c="dimmed" tt="uppercase">
          {kind}
        </Text>
        <Text size="sm">Selection details arrive in a later phase.</Text>
      </Stack>
    </Paper>
  );
}
