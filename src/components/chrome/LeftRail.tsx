import {
  Stack,
  Text,
  Group,
  Switch,
  Divider,
  ScrollArea,
  Slider,
  Tooltip,
} from '@mantine/core';
import {
  Ship,
  Plane,
  Satellite,
  Camera,
  Radio,
  AlertTriangle,
  Route,
  Wind,
  Truck,
  Anchor,
  type LucideIcon,
} from 'lucide-react';
import { useLayerStore, type LayerId } from '@/store/layers';

type LayerDef = {
  id: LayerId;
  label: string;
  icon: LucideIcon;
  phase: number;
  /** One-line practical-use description shown on hover. */
  help: string;
  /** Layers whose intensity slider actually drives visible output today. */
  liveIntensity?: boolean;
};

const LAYERS: LayerDef[] = [
  {
    id: 'vessels',
    label: 'Vessels (AIS)',
    icon: Ship,
    phase: 2,
    liveIntensity: true,
    help: 'Live cargo, tanker, and passenger ships from AISStream.io. Click any vessel for destination, course, and speed.',
  },
  {
    id: 'aircraft',
    label: 'Aircraft (ADS-B)',
    icon: Plane,
    phase: 2,
    liveIntensity: true,
    help: 'Live flights from OpenSky Network. Cargo carriers (FedEx, UPS, DHL, etc.) are highlighted in mint.',
  },
  {
    id: 'satellites',
    label: 'Earth-obs satellites',
    icon: Satellite,
    phase: 3,
    liveIntensity: true,
    help: 'Commercial Earth-observation constellations (Sentinel, Landsat, Planet, Capella, ICEYE). Click for next overpass over your focus.',
  },
  {
    id: 'webcams',
    label: 'Port webcams',
    icon: Camera,
    phase: 6,
    liveIntensity: true,
    help: 'Live HLS streams projected onto the 3D globe for a handful of hero ports. Use when you need visual confirmation of congestion.',
  },
  {
    id: 'gps',
    label: 'GPS integrity',
    icon: Radio,
    phase: 8,
    help: 'Amber choropleth where ADS-B NIC values suggest jamming or spoofing. Turn on before flying through the Black Sea or the Persian Gulf.',
  },
  {
    id: 'disruptions',
    label: 'Disruption zones',
    icon: AlertTriangle,
    phase: 5,
    help: 'Pulsing polygons from NOAA/NWS marine alerts, Open-Meteo storm outlooks, piracy reports, and curated demo events.',
  },
  {
    id: 'lanes',
    label: 'Vessel routes',
    icon: Route,
    phase: 5,
    liveIntensity: false,
    help: 'Draws a great-circle "planned route" from the selected vessel to its AIS-declared destination port.',
  },
  {
    id: 'chokepoints',
    label: 'Chokepoints',
    icon: Anchor,
    phase: 5,
    help: 'Suez, Panama, Hormuz, Malacca, Bosphorus, Bab-el-Mandeb, Dover, Cape of Good Hope. Colour reflects traffic vs baseline — see legend in bottom dock.',
  },
  {
    id: 'weather',
    label: 'Weather',
    icon: Wind,
    phase: 5,
    liveIntensity: true,
    help: 'RainViewer global precipitation radar tile overlay. Use with disruption zones to cross-check active storms.',
  },
  {
    id: 'traffic',
    label: 'Surface traffic',
    icon: Truck,
    phase: 6,
    help: 'Road/rail congestion around major port hinterlands. Placeholder — not yet wired to a live source.',
  },
];

export function LeftRail() {
  const layers = useLayerStore((s) => s.layers);
  const toggleLayer = useLayerStore((s) => s.toggle);
  const setIntensity = useLayerStore((s) => s.setIntensity);

  return (
    <Stack gap={0} h="100%">
      <Group h={36} px="md" gap="xs">
        <Text size="xs" fw={600} c="dimmed" style={{ letterSpacing: '0.08em' }}>
          LAYERS
        </Text>
      </Group>
      <Divider color="var(--meridian-border)" />
      <ScrollArea style={{ flex: 1 }} type="hover" scrollbarSize={6}>
        <Stack gap={0} p="xs">
          {LAYERS.map((layer) => {
            const Icon = layer.icon;
            const state = layers[layer.id];
            const enabled = state?.enabled ?? false;
            const intensity = state?.intensity ?? 1;
            const isLive =
              layer.phase === 2 ||
              layer.phase === 3 ||
              layer.phase === 5 ||
              layer.phase === 6;
            const showSlider = enabled && layer.liveIntensity;
            return (
              <Stack
                key={layer.id}
                gap={4}
                px="xs"
                py={6}
                style={{
                  borderRadius: 2,
                  opacity: isLive ? 1 : 0.55,
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Tooltip
                    label={layer.help}
                    withArrow
                    position="right"
                    multiline
                    w={260}
                    openDelay={120}
                  >
                    <Group gap={8} wrap="nowrap" style={{ cursor: 'help' }}>
                      <Icon size={14} />
                      <Text size="xs">{layer.label}</Text>
                    </Group>
                  </Tooltip>
                  <Switch
                    size="xs"
                    color="meridian"
                    checked={enabled}
                    onChange={(e) => toggleLayer(layer.id, e.currentTarget.checked)}
                    aria-label={`Toggle ${layer.label}`}
                  />
                </Group>
                {showSlider && (
                  <Group gap={8} wrap="nowrap" pl={22}>
                    <Tooltip
                      label="Visual intensity — lower values dim the layer without hiding it. Useful when stacking multiple overlays."
                      withArrow
                      multiline
                      w={220}
                    >
                      <Slider
                        size="xs"
                        color="meridian"
                        value={Math.round(intensity * 100)}
                        onChange={(v) => setIntensity(layer.id, v / 100)}
                        min={10}
                        max={100}
                        step={5}
                        style={{ flex: 1 }}
                        aria-label={`${layer.label} intensity`}
                        label={(v) => `${v}%`}
                      />
                    </Tooltip>
                    <Text
                      size="xs"
                      c="dimmed"
                      ff="monospace"
                      data-mono
                      style={{ width: 28, textAlign: 'right' }}
                    >
                      {Math.round(intensity * 100)}
                    </Text>
                  </Group>
                )}
              </Stack>
            );
          })}
        </Stack>
      </ScrollArea>
      <Divider color="var(--meridian-border)" />
      <Group h={32} px="md" justify="space-between">
        <Text size="xs" c="dimmed">
          {Object.values(layers).filter((l) => l.enabled).length} active
        </Text>
        <Text size="xs" c="dimmed" ff="monospace" data-mono>
          ⌘,
        </Text>
      </Group>
    </Stack>
  );
}
