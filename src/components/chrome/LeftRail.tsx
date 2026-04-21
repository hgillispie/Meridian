import { Stack, Text, Group, Switch, Divider, ScrollArea } from '@mantine/core';
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
};

const LAYERS: LayerDef[] = [
  { id: 'vessels', label: 'Vessels (AIS)', icon: Ship, phase: 2 },
  { id: 'aircraft', label: 'Aircraft (ADS-B)', icon: Plane, phase: 2 },
  { id: 'satellites', label: 'Earth-obs satellites', icon: Satellite, phase: 3 },
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
            const enabled = layers[layer.id]?.enabled ?? false;
            return (
              <Group
                key={layer.id}
                justify="space-between"
                wrap="nowrap"
                px="xs"
                py={6}
                style={{
                  borderRadius: 2,
                  opacity: layer.phase === 2 || layer.phase === 3 ? 1 : 0.55,
                }}
              >
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
