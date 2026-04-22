import { Stack, Text, Group, Switch, Divider, ScrollArea, Slider } from '@mantine/core';
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
  /** Layers whose intensity slider actually drives visible output today. */
  liveIntensity?: boolean;
};

const LAYERS: LayerDef[] = [
  { id: 'vessels', label: 'Vessels (AIS)', icon: Ship, phase: 2, liveIntensity: true },
  { id: 'aircraft', label: 'Aircraft (ADS-B)', icon: Plane, phase: 2, liveIntensity: true },
  {
    id: 'satellites',
    label: 'Earth-obs satellites',
    icon: Satellite,
    phase: 3,
    liveIntensity: true,
  },
  { id: 'webcams', label: 'Port webcams', icon: Camera, phase: 6 },
  { id: 'gps', label: 'GPS integrity', icon: Radio, phase: 8 },
  { id: 'disruptions', label: 'Disruption zones', icon: AlertTriangle, phase: 5 },
  { id: 'lanes', label: 'Shipping lanes', icon: Route, phase: 5 },
  { id: 'chokepoints', label: 'Chokepoints', icon: Anchor, phase: 5 },
  { id: 'weather', label: 'Weather', icon: Wind, phase: 5 },
  { id: 'traffic', label: 'Surface traffic', icon: Truck, phase: 6 },
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
            const isLive = layer.phase === 2 || layer.phase === 3;
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
                  <Group gap={8} wrap="nowrap">
                    <Icon size={14} />
                    <Text size="xs">{layer.label}</Text>
                  </Group>
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
