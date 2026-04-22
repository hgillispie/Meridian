import { useEffect, useState } from 'react';
import {
  Stack,
  Text,
  Group,
  Paper,
  Badge,
  Divider,
  Button,
  SegmentedControl,
} from '@mantine/core';
import { Anchor, MapPin, ExternalLink, Camera } from 'lucide-react';
import { useWebcamStore, heroWebcam, type Webcam } from '@/store/webcams';
import { useLiveDataStore } from '@/store/liveData';
import { WebcamPlayer } from '../webcams/WebcamPlayer';
import { flyTo } from '@/lib/globe/cameraApi';

type Port = {
  unlocode: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
};

/**
 * RightRail card shown when the user selects a port (globe click on a
 * webcam pin, Spotlight, or OverviewCard). Renders the hero webcam with
 * a camera-switcher when multiple feeds are curated for the same port,
 * plus vessel-activity context from the live AIS store.
 */
export function PortCard({ portCode }: { portCode: string }) {
  const webcams = useWebcamStore((s) => s.webcams);
  const setPip = useWebcamStore((s) => s.setPip);
  const pipId = useWebcamStore((s) => s.pipId);
  const vessels = useLiveDataStore((s) => s.vessels);

  const [port, setPort] = useState<Port | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/data/ports.json')
      .then((r) => r.json() as Promise<{ ports: Port[] }>)
      .then((d) => {
        if (cancelled) return;
        const found = d.ports.find((p) => p.unlocode === portCode);
        setPort(found ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setPort(null);
      });
    return () => {
      cancelled = true;
    };
  }, [portCode]);

  // All webcams registered against this port, hero first.
  const portCams = webcams.filter((w) => w.portCode === portCode);
  const hero = heroWebcam(webcams, portCode);
  const [activeCamId, setActiveCamId] = useState<string | null>(
    hero?.id ?? null
  );
  useEffect(() => {
    setActiveCamId(hero?.id ?? null);
  }, [hero?.id]);
  const activeCam: Webcam | null =
    portCams.find((w) => w.id === activeCamId) ?? hero;

  // Cheap "vessels near port" heuristic — ~0.5° bbox. Good enough for a
  // sidebar summary; the proper version would use port polygons.
  const nearby = port
    ? Object.values(vessels).filter(
        (v) =>
          v.lat != null &&
          v.lon != null &&
          Math.abs(v.lat - port.lat) < 0.5 &&
          Math.abs(v.lon - port.lon) < 0.5
      )
    : [];

  return (
    <Stack gap="sm">
      <Stack gap={2}>
        <Group gap="xs">
          <Anchor size={14} color="var(--meridian-accent)" />
          <Text
            size="xs"
            tt="uppercase"
            c="dimmed"
            style={{ letterSpacing: '0.08em' }}
          >
            Port · {port?.country ?? '—'}
          </Text>
        </Group>
        <Text size="lg" fw={600} lh={1.15}>
          {port?.name ?? portCode}
        </Text>
        <Group gap={4}>
          <Badge size="xs" variant="outline" color="meridian">
            {portCode}
          </Badge>
          {portCams.length > 0 && (
            <Badge
              size="xs"
              variant="light"
              color="meridian"
              leftSection={<Camera size={10} />}
            >
              {portCams.length} cam{portCams.length > 1 ? 's' : ''}
            </Badge>
          )}
        </Group>
      </Stack>

      {activeCam ? (
        <Stack gap={6}>
          <WebcamPlayer webcam={activeCam} size="small" />
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Text size="10px" c="dimmed" lh={1.3}>
              {activeCam.title}
              {activeCam.attribution ? ` · ${activeCam.attribution}` : ''}
            </Text>
            <Button
              size="compact-xs"
              variant={pipId === activeCam.id ? 'light' : 'subtle'}
              color="meridian"
              leftSection={<ExternalLink size={12} />}
              onClick={() =>
                setPip(pipId === activeCam.id ? null : activeCam.id)
              }
            >
              {pipId === activeCam.id ? 'Hide PiP' : 'Pop out'}
            </Button>
          </Group>
          {portCams.length > 1 && (
            <SegmentedControl
              size="xs"
              fullWidth
              color="meridian"
              value={activeCam.id}
              onChange={setActiveCamId}
              data={portCams.map((c) => ({
                value: c.id,
                label: c.title.replace(/^.* — /, ''),
              }))}
            />
          )}
        </Stack>
      ) : (
        <Paper p="sm" withBorder>
          <Text size="xs" c="dimmed">
            No webcam curated for this port yet.
          </Text>
        </Paper>
      )}

      <Divider color="var(--meridian-border)" />

      <Group grow gap="xs">
        <Stat
          icon={<MapPin size={12} />}
          label="Nearby vessels"
          value={String(nearby.length)}
          hint={nearby.length ? 'AIS, 0.5° radius' : undefined}
        />
        <Stat
          label="Position"
          value={
            port
              ? `${port.lat.toFixed(2)}°, ${port.lon.toFixed(2)}°`
              : '—'
          }
        />
      </Group>

      {port && (
        <Button
          size="compact-xs"
          variant="subtle"
          color="meridian"
          onClick={() => flyTo(port.lon, port.lat, 60_000)}
        >
          Zoom to port
        </Button>
      )}
    </Stack>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
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
      {hint && (
        <Text size="10px" c="dimmed" ff="monospace" data-mono>
          {hint}
        </Text>
      )}
    </Paper>
  );
}
