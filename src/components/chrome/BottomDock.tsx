import {
  Group,
  Stack,
  Text,
  ActionIcon,
  SegmentedControl,
  Slider,
  Tooltip,
  Badge,
  Divider,
} from '@mantine/core';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
} from 'lucide-react';
import { useClockStore } from '@/store/clock';
import { useViewModeStore, type ViewMode } from '@/store/viewMode';
import { ChokepointLegend } from './ChokepointLegend';

const VIEW_MODES: { label: string; value: ViewMode; help: string }[] = [
  {
    label: 'Daylight',
    value: 'daylight',
    help: 'Default photorealistic lighting. Best for recognising coastlines and buildings.',
  },
  {
    label: '24-Hour Ops',
    value: 'nightops',
    help: 'Tone-mapped night-vision palette. Use in a dim room or when colour drift from weather layers is distracting.',
  },
  {
    label: 'Density',
    value: 'density',
    help: 'Heatmap of vessel + aircraft concentration. Great for spotting queue buildup at a glance.',
  },
  {
    label: 'Blueprint',
    value: 'blueprint',
    help: 'Edge-detect + cross-hatch. Reads like an ops schematic — emphasises shapes over colour.',
  },
  {
    label: 'Retro',
    value: 'retro',
    help: 'CRT-style scanlines + chromatic aberration. Demo/presentation mode, not operational.',
  },
];

/**
 * NOTE on the timeline scrubber: it controls `viewer.clock.currentTime`,
 * which drives satellite orbit traces + any layer that samples a
 * `SampledPositionProperty`. Live vessels and aircraft cannot rewind
 * without bundled replay data (Phase 8). Until that ships, scrubbing to
 * −24h changes the LIVE/REPLAY badge and the satellite positions but the
 * ship/plane billboards stay at their latest known positions. The
 * tooltip below is explicit about that so users don't expect more.
 */
export function BottomDock() {
  const { speed, setSpeed, position, setPosition, playing, play, pause } =
    useClockStore();
  const { mode, setMode } = useViewModeStore();

  const nudge = (deltaHours: number) => {
    setPosition(Math.max(-168, Math.min(0, position + deltaHours)));
  };

  const isReplay = position < -0.05;

  return (
    <Stack gap={0} h="100%">
      <Group h={40} px="md" gap="md" wrap="nowrap">
        <Group gap={4}>
          <Tooltip label="Jump back 24 hours" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Skip back 24h"
              onClick={() => nudge(-24)}
            >
              <SkipBack size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Rewind 1 hour" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Rewind 1h"
              onClick={() => nudge(-1)}
            >
              <Rewind size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip
            label={
              playing
                ? 'Pause clock (freezes satellite propagation)'
                : 'Resume clock'
            }
            withArrow
          >
            <ActionIcon
              variant="filled"
              color="meridian"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() => (playing ? pause() : play())}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Advance 1 hour" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Fast forward 1h"
              onClick={() => nudge(1)}
            >
              <FastForward size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Jump forward 24 hours (clamped at now)" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Skip forward 24h"
              onClick={() => nudge(24)}
            >
              <SkipForward size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Tooltip
          label="Playback rate for the simulated clock. Affects satellite propagation speed."
          withArrow
        >
          <Text
            size="xs"
            ff="monospace"
            c="dimmed"
            data-mono
            style={{ minWidth: 48, cursor: 'help' }}
          >
            {speed}×
          </Text>
        </Tooltip>

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

        {isReplay ? (
          <Badge size="xs" variant="light" color="yellow">
            REPLAY {Math.round(position)}h
          </Badge>
        ) : (
          <Badge size="xs" variant="light" color="meridian">
            LIVE
          </Badge>
        )}

        <Tooltip
          label="Scrub the simulated clock. Satellite orbits re-propagate to the selected time. Live vessels/aircraft do not rewind until bundled replay data is enabled."
          withArrow
          multiline
          w={280}
        >
          <div style={{ flex: 1 }}>
            <Slider
              size="xs"
              color="meridian"
              value={position}
              onChange={setPosition}
              min={-168}
              max={0}
              step={1}
              label={(v) => `${v === 0 ? 'now' : `${v}h`}`}
              marks={[
                { value: -168, label: '−7d' },
                { value: -72, label: '−72h' },
                { value: -24, label: '−24h' },
                { value: 0, label: 'now' },
              ]}
            />
          </div>
        </Tooltip>

        <Divider orientation="vertical" />
        <ChokepointLegend />
        <Divider orientation="vertical" />

        <Tooltip
          label={
            VIEW_MODES.find((m) => m.value === mode)?.help ??
            'Switch globe rendering mode.'
          }
          withArrow
          multiline
          w={260}
        >
          <div>
            <SegmentedControl
              size="xs"
              value={mode}
              onChange={(v) => setMode(v as ViewMode)}
              data={VIEW_MODES.map(({ label, value }) => ({ label, value }))}
            />
          </div>
        </Tooltip>
      </Group>
    </Stack>
  );
}
