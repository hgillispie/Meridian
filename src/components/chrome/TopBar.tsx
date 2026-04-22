import { Badge, Group, Kbd, Text, UnstyledButton, ActionIcon } from '@mantine/core';
import { spotlight } from '@mantine/spotlight';
import { Search, Settings, CircleUserRound } from 'lucide-react';
import { UtcClock } from './UtcClock';
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

      <Group gap="sm" wrap="nowrap">
        <UtcClock />
        <Badge
          variant="light"
          color={isReplay ? 'yellow' : 'meridian'}
          size="sm"
          style={{ letterSpacing: '0.08em' }}
        >
          {isReplay ? `REPLAY ${Math.round(position)}h` : 'LIVE'}
        </Badge>
        <ActionIcon variant="subtle" color="gray" aria-label="Settings">
          <Settings size={16} />
        </ActionIcon>
        <ActionIcon variant="subtle" color="gray" aria-label="Account">
          <CircleUserRound size={16} />
        </ActionIcon>
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
