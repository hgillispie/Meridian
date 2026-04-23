import {
  Badge,
  Group,
  Kbd,
  Text,
  UnstyledButton,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { spotlight } from '@mantine/spotlight';
import { Search, Settings, CircleUserRound } from 'lucide-react';
import { UtcClock } from './UtcClock';
import { EventFeedTrigger } from './EventFeed';
import { useClockStore } from '@/store/clock';

/**
 * Top bar (§6.1): logo, global search trigger, UTC clock,
 * LIVE/REPLAY chip, settings, avatar.
 */
export function TopBar() {
  const position = useClockStore((s) => s.position);
  const isReplay = position < -0.05; // ~3 minutes into the past
  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        <LogoMark />
        <Text
          size="sm"
          fw={600}
          style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}
        >
          Meridian
        </Text>
        <Badge variant="outline" color="meridian" size="xs">
          v0.0.1
        </Badge>
      </Group>

      <Tooltip
        label="Open global command palette — search ports, vessels, flights, satellites, cities. Prefix queries with @port / @sat / @flight to scope."
        withArrow
        multiline
        w={320}
      >
        <UnstyledButton
          onClick={() => spotlight.open()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            border: '1px solid var(--meridian-border)',
            borderRadius: 2,
            background: 'var(--meridian-surface-elevated)',
            color: 'var(--meridian-text-muted)',
            minWidth: 320,
          }}
        >
          <Search size={14} />
          <Text size="xs" c="dimmed" style={{ flex: 1, textAlign: 'left' }}>
            Search ports, vessels, flights, satellites…
          </Text>
          <Kbd size="xs">⌘</Kbd>
          <Kbd size="xs">K</Kbd>
        </UnstyledButton>
      </Tooltip>

      <Group gap="sm" wrap="nowrap">
        <EventFeedTrigger />
        <UtcClock />
        <Tooltip
          label={
            isReplay
              ? `Replay mode: clock is ${Math.round(position)}h in the past. Satellite positions reflect that time; vessels/aircraft show latest live positions until replay data is bundled.`
              : 'Live mode — clock is tracking real time. Data updates as upstream sources push.'
          }
          withArrow
          multiline
          w={280}
        >
          <Badge
            variant="light"
            color={isReplay ? 'yellow' : 'meridian'}
            size="sm"
            style={{ letterSpacing: '0.08em', cursor: 'help' }}
          >
            {isReplay ? `REPLAY ${Math.round(position)}h` : 'LIVE'}
          </Badge>
        </Tooltip>
        <Tooltip label="Settings (keyboard shortcut: ⌘,)" withArrow>
          <ActionIcon variant="subtle" color="gray" aria-label="Settings">
            <Settings size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Account" withArrow>
          <ActionIcon variant="subtle" color="gray" aria-label="Account">
            <CircleUserRound size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}

function LogoMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="10" fill="none" stroke="#00E5A8" strokeWidth="1.5" />
      <path d="M16 6 L16 26" stroke="#00E5A8" strokeWidth="1.5" />
      <path d="M6 16 L26 16" stroke="#00E5A8" strokeWidth="1.5" opacity="0.5" />
      <ellipse
        cx="16"
        cy="16"
        rx="5"
        ry="10"
        fill="none"
        stroke="#00E5A8"
        strokeWidth="1"
        opacity="0.7"
      />
    </svg>
  );
}
