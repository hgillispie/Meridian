import { Group, Stack, Text, ActionIcon, SegmentedControl, Slider } from '@mantine/core';
import { Play, Pause, SkipBack, SkipForward, Rewind, FastForward } from 'lucide-react';
import { useClockStore } from '@/store/clock';
import { useViewModeStore, type ViewMode } from '@/store/viewMode';

const VIEW_MODES: { label: string; value: ViewMode }[] = [
  { label: 'Daylight', value: 'daylight' },
  { label: '24-Hour Ops', value: 'nightops' },
  { label: 'Density', value: 'density' },
  { label: 'Blueprint', value: 'blueprint' },
  { label: 'Retro', value: 'retro' },
];

export function BottomDock() {
  const { speed, setSpeed, position, setPosition, playing, play, pause } =
    useClockStore();
  const { mode, setMode } = useViewModeStore();

  const nudge = (deltaHours: number) => {
    setPosition(Math.max(-168, Math.min(0, position + deltaHours)));
  };

  return (
    <Stack gap={0} h="100%">
      <Group h={40} px="md" gap="md" wrap="nowrap">
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Skip back 24h"
            onClick={() => nudge(-24)}
          >
            <SkipBack size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Rewind 1h"
            onClick={() => nudge(-1)}
          >
            <Rewind size={14} />
          </ActionIcon>
          <ActionIcon
            variant="filled"
            color="meridian"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => (playing ? pause() : play())}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Fast forward 1h"
            onClick={() => nudge(1)}
          >
            <FastForward size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Skip forward 24h"
            onClick={() => nudge(24)}
          >
            <SkipForward size={14} />
          </ActionIcon>
        </Group>

        <Text size="xs" ff="monospace" c="dimmed" data-mono style={{ minWidth: 48 }}>
          {speed}×
        </Text>

        <SegmentedControl
          size="xs"
          value={String(speed)}
          onChange={(v) => setSpeed(Number(v) as 1 | 10 | 100)}
          data={[
            { value: '1', label: '1×' },
            { value: '10', label: '10×' },
            { value: '100', label: '100×' },
          ]}
        />

        <Slider
          size="xs"
          color="meridian"
          value={position}
          onChange={setPosition}
          min={-168}
          max={0}
          step={1}
          style={{ flex: 1 }}
          label={(v) => `${v === 0 ? 'now' : `${v}h`}`}
          marks={[
            { value: -168, label: '−7d' },
            { value: -72, label: '−72h' },
            { value: -24, label: '−24h' },
            { value: 0, label: 'now' },
          ]}
        />

        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(v) => setMode(v as ViewMode)}
          data={VIEW_MODES}
        />
      </Group>
    </Stack>
  );
}
