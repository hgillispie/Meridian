import { Stack, Text, Group, Divider, ScrollArea, Badge } from '@mantine/core';
import { useSelectionStore } from '@/store/selection';
import { OverviewCard } from '../cards/OverviewCard';
import { PlaceholderCard } from '../cards/PlaceholderCard';

export function RightRail() {
  const selection = useSelectionStore((s) => s.selection);

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
          {selection && <PlaceholderCard kind={selection.kind} />}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
