import { useEffect, useMemo, useState } from 'react';
import { Stack, Text, Group, Paper, Badge, Divider } from '@mantine/core';
import { Satellite as SatIcon, Clock, Gauge, Target } from 'lucide-react';
import type { Satellite } from '@/types/satellite';
import { satelliteColor } from '@/types/satellite';
import {
  approxAltitudeMeters,
  prepareSatrec,
  type PreparedSat,
} from '@/lib/orbit/propagate';
import { nextOverpass, type Overpass } from '@/lib/orbit/nextOverpass';

/** Default overpass target: Singapore Strait — same as the initial camera. */
const DEFAULT_TARGET = { lat: 1.29, lon: 103.85, name: 'Singapore' };

export function SatelliteCard({ satellite }: { satellite: Satellite | undefined }) {
  if (!satellite) {
    return (
      <Paper p="md" withBorder>
        <Text size="xs" c="dimmed">
          Satellite no longer in the active catalog. Its TLE may have been
          archived or it has decayed from orbit.
        </Text>
      </Paper>
    );
  }

  const category = satellite.category ?? 'other';
  const color = satelliteColor(category);

  const prepared = useMemo<PreparedSat | null>(() => {
    try {
      return prepareSatrec(satellite);
    } catch {
      return null;
    }
  }, [satellite]);

  const altitudeKm = useMemo(
    () => (prepared ? Math.round(approxAltitudeMeters(prepared) / 1000) : null),
    [prepared]
  );

  const [overpass, setOverpass] = useState<Overpass | null>(null);
  const [overpassStatus, setOverpassStatus] = useState<'idle' | 'solving' | 'done' | 'none'>('idle');
  useEffect(() => {
    if (!prepared) return;
    setOverpassStatus('solving');
    // Solver is CPU-bound but fast (~10–30 ms per bird). Run in a microtask
    // so we don't jank the first paint of the card.
    queueMicrotask(() => {
      try {
        const result = nextOverpass(prepared, DEFAULT_TARGET);
        setOverpass(result);
        setOverpassStatus(result ? 'done' : 'none');
      } catch {
        setOverpassStatus('none');
      }
    });
  }, [prepared]);

  return (
    <Stack gap="sm">
      <Stack gap={2}>
        <Group gap="xs">
          <SatIcon size={14} color={color} />
          <Text size="xs" tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
            {categoryLabel(category)}
          </Text>
        </Group>
        <Text size="lg" fw={600} lh={1.15}>
          {satellite.name}
        </Text>
        <Group gap={4}>
          <Badge variant="outline" size="xs">
            NORAD {satellite.noradId}
          </Badge>
          {satellite.cospar && (
            <Badge variant="outline" size="xs">
              {satellite.cospar}
            </Badge>
          )}
          {satellite.operator && (
            <Badge variant="outline" size="xs" color="meridian">
              {satellite.operator}
            </Badge>
          )}
        </Group>
      </Stack>

      {satellite.mission && (
        <Text size="xs" c="dimmed">
          {satellite.mission}
        </Text>
      )}

      <Divider color="var(--meridian-border)" />

      <Group grow gap="xs">
        <Metric
          icon={<Gauge size={12} />}
          label="Period"
          value={satellite.periodMin ? `${satellite.periodMin.toFixed(1)} min` : '—'}
        />
        <Metric
          icon={<Target size={12} />}
          label="Altitude"
          value={altitudeKm != null ? `${altitudeKm} km` : '—'}
        />
      </Group>

      <Divider color="var(--meridian-border)" />

      <Stack gap={4}>
        <Group gap={4}>
          <Clock size={12} color="var(--mantine-color-dimmed)" />
          <Text size="10px" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
            Next overpass · {DEFAULT_TARGET.name}
          </Text>
        </Group>
        {overpassStatus === 'solving' && (
          <Text size="xs" c="dimmed">
            Solving…
          </Text>
        )}
        {overpassStatus === 'none' && (
          <Text size="xs" c="dimmed">
            No pass above 10° in the next 24 h.
          </Text>
        )}
        {overpass && overpassStatus === 'done' && (
          <>
            <Row
              label="Peak"
              value={formatWhen(overpass.peakAt)}
            />
            <Row
              label="Elevation"
              value={`${overpass.peakElevationDeg.toFixed(1)}°`}
            />
            <Row
              label="Azimuth"
              value={`${overpass.azimuthDeg.toFixed(0)}°`}
            />
            <Row
              label="Duration"
              value={`${Math.round(overpass.durationSec)} s`}
            />
          </>
        )}
      </Stack>
    </Stack>
  );
}

function categoryLabel(c: string): string {
  switch (c) {
    case 'eo-optical':
      return 'EO · Optical';
    case 'eo-radar':
      return 'EO · SAR';
    case 'eo-other':
      return 'EO · Atmospheric';
    case 'comms':
      return 'Comms';
    case 'nav':
      return 'Navigation';
    case 'science':
      return 'Science';
    default:
      return 'Satellite';
  }
}

function formatWhen(epochMs: number): string {
  const diffSec = Math.round((epochMs - Date.now()) / 1000);
  const d = new Date(epochMs);
  const hhmm = d.toISOString().slice(11, 16);
  if (diffSec < 60) return `in ${diffSec}s · ${hhmm} UTC`;
  if (diffSec < 3600) return `in ${Math.round(diffSec / 60)}m · ${hhmm} UTC`;
  const h = Math.floor(diffSec / 3600);
  const m = Math.round((diffSec % 3600) / 60);
  return `in ${h}h ${m}m · ${hhmm} UTC`;
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
