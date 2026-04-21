import { Stack, Text, Group, Paper, Badge, Divider } from '@mantine/core';
import { Anchor, Compass, Gauge, Navigation } from 'lucide-react';
import type { Vessel } from '@/types/vessel';
import { categorizeShipType, vesselColor } from '@/types/vessel';

export function VesselCard({ vessel }: { vessel: Vessel | undefined }) {
  if (!vessel) {
    return (
      <Paper p="md" withBorder>
        <Text size="xs" c="dimmed">
          Vessel no longer in the feed. It may have left the viewport or ceased
          broadcasting.
        </Text>
      </Paper>
    );
  }

  const category = categorizeShipType(vessel.shipType);
  const color = vesselColor(category);

  return (
    <Stack gap="sm">
      <Stack gap={2}>
        <Group gap="xs">
          <Anchor size={14} color={color} />
          <Text size="xs" tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
            {category}
          </Text>
        </Group>
        <Text size="lg" fw={600} lh={1.15}>
          {vessel.name ?? `MMSI ${vessel.mmsi}`}
        </Text>
        <Group gap={4}>
          <Badge variant="outline" size="xs">
            MMSI {vessel.mmsi}
          </Badge>
          {vessel.imo && (
            <Badge variant="outline" size="xs">
              IMO {vessel.imo}
            </Badge>
          )}
          {vessel.callSign && (
            <Badge variant="outline" size="xs">
              {vessel.callSign}
            </Badge>
          )}
        </Group>
      </Stack>

      <Divider color="var(--meridian-border)" />

      <Group grow gap="xs">
        <Metric
          icon={<Gauge size={12} />}
          label="Speed"
          value={vessel.sog != null ? `${vessel.sog.toFixed(1)} kn` : '—'}
        />
        <Metric
          icon={<Compass size={12} />}
          label="Heading"
          value={vessel.heading != null ? `${vessel.heading.toFixed(0)}°` : '—'}
        />
      </Group>
      <Group grow gap="xs">
        <Metric
          icon={<Navigation size={12} />}
          label="Course"
          value={vessel.cog != null ? `${vessel.cog.toFixed(0)}°` : '—'}
        />
        <Metric
          label="Position"
          value={`${vessel.lat.toFixed(2)}°, ${vessel.lon.toFixed(2)}°`}
        />
      </Group>

      {(vessel.destination || vessel.length || vessel.draft) && (
        <>
          <Divider color="var(--meridian-border)" />
          <Stack gap={4}>
            {vessel.destination && (
              <Row label="Destination" value={vessel.destination} />
            )}
            {vessel.length != null && (
              <Row label="Length" value={`${vessel.length} m`} />
            )}
            {vessel.draft != null && <Row label="Draft" value={`${vessel.draft} m`} />}
          </Stack>
        </>
      )}

      <Text size="10px" c="dimmed" ff="monospace" data-mono>
        Last ping · {new Date(vessel.t).toISOString().replace('T', ' ').slice(0, 19)}Z
      </Text>
    </Stack>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Paper p="xs" withBorder>
      <Group gap={4} mb={2}>
        {icon}
        <Text size="10px" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
          {label}
        </Text>
      </Group>
      <Text size="sm" fw={500} ff="monospace" data-mono>
        {value}
      </Text>
    </Paper>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="xs" ff="monospace" data-mono>
        {value}
      </Text>
    </Group>
  );
}
