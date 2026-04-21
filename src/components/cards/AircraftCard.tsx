import { Stack, Text, Group, Paper, Badge, Divider } from '@mantine/core';
import { Plane, Gauge, Mountain, Navigation } from 'lucide-react';
import type { Aircraft } from '@/types/aircraft';

export function AircraftCard({
  aircraft,
  isCargo,
}: {
  aircraft: Aircraft | undefined;
  isCargo: boolean;
}) {
  if (!aircraft) {
    return (
      <Paper p="md" withBorder>
        <Text size="xs" c="dimmed">
          Aircraft no longer in the feed.
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="sm">
      <Stack gap={2}>
        <Group gap="xs">
          <Plane size={14} color={isCargo ? '#00E5A8' : '#8892A0'} />
          <Text size="xs" tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
            {isCargo ? 'Cargo' : 'Passenger'}
          </Text>
        </Group>
        <Text size="lg" fw={600} lh={1.15}>
          {aircraft.callsign ?? aircraft.icao24.toUpperCase()}
        </Text>
        <Group gap={4}>
          <Badge variant="outline" size="xs">
            {aircraft.icao24.toUpperCase()}
          </Badge>
          <Badge variant="outline" size="xs">
            {aircraft.originCountry}
          </Badge>
        </Group>
      </Stack>

      <Divider color="var(--meridian-border)" />

      <Group grow gap="xs">
        <Metric
          icon={<Gauge size={12} />}
          label="Ground speed"
          value={
            aircraft.velocity != null
              ? `${Math.round(aircraft.velocity * 1.94384)} kn`
              : '—'
          }
        />
        <Metric
          icon={<Mountain size={12} />}
          label="Altitude"
          value={
            aircraft.altBaro != null
              ? `${Math.round(aircraft.altBaro * 3.28084).toLocaleString()} ft`
              : '—'
          }
        />
      </Group>
      <Group grow gap="xs">
        <Metric
          icon={<Navigation size={12} />}
          label="Heading"
          value={aircraft.heading != null ? `${aircraft.heading.toFixed(0)}°` : '—'}
        />
        <Metric
          label="V/S"
          value={
            aircraft.verticalRate != null
              ? `${aircraft.verticalRate > 0 ? '↑' : aircraft.verticalRate < 0 ? '↓' : ''}${Math.abs(Math.round(aircraft.verticalRate * 196.85)).toLocaleString()} fpm`
              : '—'
          }
        />
      </Group>

      <Text size="10px" c="dimmed" ff="monospace" data-mono>
        Last contact · {new Date(aircraft.lastContact * 1000).toISOString().replace('T', ' ').slice(0, 19)}Z
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
