import { Stack, Text, Group, Divider, ScrollArea, Badge } from '@mantine/core';
import { useSelectionStore } from '@/store/selection';
import { useLiveDataStore } from '@/store/liveData';
import { useSatelliteStore } from '@/store/satellites';
import { OverviewCard } from '../cards/OverviewCard';
import { PlaceholderCard } from '../cards/PlaceholderCard';
import { VesselCard } from '../cards/VesselCard';
import { AircraftCard } from '../cards/AircraftCard';
import { SatelliteCard } from '../cards/SatelliteCard';
import { ChokepointCard } from '../cards/ChokepointCard';
import { PortCard } from '../cards/PortCard';
import type { ChokepointId } from '@/store/chokepoints';

export function RightRail() {
  const selection = useSelectionStore((s) => s.selection);
  const vessels = useLiveDataStore((s) => s.vessels);
  const aircraft = useLiveDataStore((s) => s.aircraft);
  const cargoIcaos = useLiveDataStore((s) => s.cargoIcaos);
  const satellitesById = useSatelliteStore((s) => s.byId);

  return (
    <Stack gap={0} h="100%">
      <Group h={36} px="md" justify="space-between">
        <Text size="xs" fw={600} c="dimmed" style={{ letterSpacing: '0.08em' }}>
          CONTEXT
        </Text>
        {selection && (
          <Badge variant="outline" size="xs" color="meridian">
            {selection.kind}
          </Badge>
        )}
      </Group>
      <Divider color="var(--meridian-border)" />
      <ScrollArea style={{ flex: 1 }} type="hover" scrollbarSize={6}>
        <Stack p="md" gap="md">
          {!selection && <OverviewCard />}
          {selection?.kind === 'vessel' && (
            <VesselCard vessel={vessels[Number(selection.id)]} />
          )}
          {selection?.kind === 'aircraft' && (() => {
            const a = aircraft[selection.id];
            const prefix = a?.callsign?.replace(/[^A-Z]/g, '').slice(0, 3).toUpperCase();
            const isCargo = !!prefix && cargoIcaos.has(prefix);
            return <AircraftCard aircraft={a} isCargo={isCargo} />;
          })()}
          {selection?.kind === 'satellite' && (
            <SatelliteCard satellite={satellitesById[Number(selection.id)]} />
          )}
          {selection?.kind === 'chokepoint' && (
            <ChokepointCard id={selection.id as ChokepointId} />
          )}
          {selection?.kind === 'port' && <PortCard portCode={selection.id} />}
          {selection &&
            selection.kind !== 'vessel' &&
            selection.kind !== 'aircraft' &&
            selection.kind !== 'satellite' &&
            selection.kind !== 'chokepoint' &&
            selection.kind !== 'port' && <PlaceholderCard kind={selection.kind} />}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
