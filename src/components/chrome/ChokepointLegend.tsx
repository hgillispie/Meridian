import { Group, Popover, Text, Stack, ActionIcon, Tooltip } from '@mantine/core';
import { Info } from 'lucide-react';
import { CHOKEPOINT_STATUS_LEGEND } from '@/lib/globe/chokepointStatus';
import { useLayerStore } from '@/store/layers';

/**
 * Compact legend chip for chokepoint status colours. Mounts in the
 * BottomDock so the user can decode what the globe polygons mean without
 * leaving the main view. Clicking the info button opens a popover with
 * the full rubric.
 *
 * Hidden when the chokepoints layer is off — there's nothing to decode.
 */
export function ChokepointLegend() {
  const enabled = useLayerStore((s) => s.layers.chokepoints.enabled);
  if (!enabled) return null;

  return (
    <Group gap={6} wrap="nowrap">
      <Text
        size="xs"
        c="dimmed"
        ff="monospace"
        data-mono
        style={{ letterSpacing: '0.06em' }}
      >
        CHOKEPOINTS
      </Text>
      {CHOKEPOINT_STATUS_LEGEND.map((s) => (
        <Tooltip
          key={s.status}
          label={s.description}
          withArrow
          position="top"
          multiline
          w={220}
        >
          <Group gap={4} wrap="nowrap" style={{ cursor: 'help' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: s.color,
                boxShadow: `0 0 6px ${s.color}88`,
                flexShrink: 0,
              }}
              aria-hidden
            />
            <Text size="xs" c="dimmed">
              {s.label}
            </Text>
          </Group>
        </Tooltip>
      ))}
      <Popover width={300} position="top-end" withArrow shadow="md">
        <Popover.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="xs"
            aria-label="Chokepoint legend details"
          >
            <Info size={12} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap={8}>
            <Text size="xs" fw={600}>
              How chokepoint status is computed
            </Text>
            {CHOKEPOINT_STATUS_LEGEND.map((s) => (
              <Group key={s.status} gap={8} wrap="nowrap" align="flex-start">
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: s.color,
                    marginTop: 4,
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
                <Stack gap={0}>
                  <Text size="xs" fw={600}>
                    {s.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {s.description}
                  </Text>
                </Stack>
              </Group>
            ))}
            <Text size="xs" c="dimmed" mt={4}>
              Any chokepoint overlapping an active high-severity disruption
              (piracy, closure) is forced to Critical regardless of traffic —
              that's why Bab-el-Mandeb pulses red.
            </Text>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
}
