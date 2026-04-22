import { useEffect, useMemo, useState } from 'react';
import {
  Drawer,
  Group,
  Stack,
  Text,
  ActionIcon,
  Badge,
  ScrollArea,
  Divider,
  UnstyledButton,
} from '@mantine/core';
import {
  AlertTriangle,
  Cloud,
  Ship,
  Radio,
  FileWarning,
  Sparkles,
  Rss,
} from 'lucide-react';
import { useEventsStore, type EventRow, type EventKind } from '@/store/events';
import { useDisruptionStore } from '@/store/disruptions';
import { flyTo } from '@/lib/globe/cameraApi';

/**
 * Two views of the event stream:
 *   - Inline marquee — top-bar always-visible chip showing the most
 *     recent event (auto-rotating every 5 s if multiple are queued).
 *   - Drawer — scrollable full feed with click-to-fly-to for geo-tagged
 *     events. Non-geo events render without a button.
 */

const MARQUEE_INTERVAL_MS = 5000;

export function EventFeedTrigger() {
  const events = useEventsStore((s) => s.events);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  // Rotate through the latest events on an interval. Reset cursor when
  // event count changes so we always start from the freshest item.
  useEffect(() => {
    if (events.length <= 1) return;
    const id = window.setInterval(() => {
      setCursor((c) => (c + 1) % events.length);
    }, MARQUEE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [events.length]);

  const visible = useMemo(() => {
    if (events.length === 0) return null;
    return events[cursor % events.length];
  }, [events, cursor]);

  return (
    <>
      <UnstyledButton
        onClick={() => setOpen(true)}
        aria-label="Open event feed"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          border: '1px solid var(--meridian-border)',
          borderRadius: 2,
          background: 'var(--meridian-surface-elevated)',
          color: 'var(--meridian-text)',
          maxWidth: 360,
          height: 28,
        }}
      >
        <Rss size={13} color="var(--meridian-accent)" />
        {visible ? (
          <>
            <Badge
              size="xs"
              variant="outline"
              color={kindColor(visible.kind)}
              style={{ textTransform: 'none' }}
            >
              {kindLabel(visible.kind)}
            </Badge>
            <Text size="xs" truncate style={{ flex: 1 }}>
              {visible.title}
            </Text>
          </>
        ) : (
          <Text size="xs" c="dimmed">
            No active events
          </Text>
        )}
        <Text size="10px" c="dimmed" ff="monospace" data-mono>
          {events.length}
        </Text>
      </UnstyledButton>

      <EventFeedDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function EventFeedDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const events = useEventsStore((s) => s.events);
  const disruptions = useDisruptionStore((s) => s.disruptions);

  return (
    <Drawer
      opened={open}
      onClose={onClose}
      position="right"
      size={460}
      title={
        <Group gap="xs">
          <Rss size={14} color="var(--meridian-accent)" />
          <Text size="sm" fw={600}>
            Event feed
          </Text>
          <Badge variant="outline" size="xs">
            {events.length}
          </Badge>
        </Group>
      }
      overlayProps={{ opacity: 0.35, blur: 2 }}
      padding={0}
    >
      <ScrollArea h="100vh" type="hover" scrollbarSize={6}>
        <Stack gap={0}>
          {events.length === 0 && (
            <Text size="xs" c="dimmed" p="md">
              No events yet — waiting for NOAA alerts, Open-Meteo storm
              forecasts, and curated disruptions to stream in.
            </Text>
          )}
          {events.map((e) => {
            const disruptionId = e.id.replace(/^disruption:/, '');
            const disruption = disruptions[disruptionId];
            return (
              <EventRowView
                key={e.id}
                event={e}
                onFlyTo={
                  disruption
                    ? () => flyTo(disruption.center[0], disruption.center[1], 800_000)
                    : undefined
                }
              />
            );
          })}
        </Stack>
      </ScrollArea>
    </Drawer>
  );
}

function EventRowView({
  event,
  onFlyTo,
}: {
  event: EventRow;
  onFlyTo?: () => void;
}) {
  const Icon = kindIcon(event.kind);
  const when = relTime(event.startedAt);
  return (
    <>
      <UnstyledButton
        onClick={onFlyTo}
        disabled={!onFlyTo}
        style={{ display: 'block', width: '100%', textAlign: 'left' }}
      >
        <Group align="flex-start" gap="sm" wrap="nowrap" p="md">
          <ActionIcon variant="subtle" color={kindColor(event.kind)} size="sm">
            <Icon size={14} />
          </ActionIcon>
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Group gap={6} wrap="nowrap">
              <Badge
                size="xs"
                variant="outline"
                color={kindColor(event.kind)}
                style={{ textTransform: 'none' }}
              >
                {kindLabel(event.kind)}
              </Badge>
              <Text size="10px" c="dimmed" ff="monospace" data-mono>
                {when}
              </Text>
            </Group>
            <Text size="xs" fw={500}>
              {event.title}
            </Text>
            {event.detail && (
              <Text size="xs" c="dimmed" lineClamp={2}>
                {event.detail}
              </Text>
            )}
          </Stack>
        </Group>
      </UnstyledButton>
      <Divider color="var(--meridian-border)" />
    </>
  );
}

function kindIcon(k: EventKind) {
  switch (k) {
    case 'weather':
      return Cloud;
    case 'port-status':
      return Ship;
    case 'gps':
      return Radio;
    case 'piracy':
      return AlertTriangle;
    case 'regulatory':
      return FileWarning;
    case 'demo':
      return Sparkles;
  }
}

function kindLabel(k: EventKind): string {
  switch (k) {
    case 'weather':
      return 'Weather';
    case 'port-status':
      return 'Port';
    case 'gps':
      return 'GPS';
    case 'piracy':
      return 'Security';
    case 'regulatory':
      return 'Regulatory';
    case 'demo':
      return 'Event';
  }
}

function kindColor(k: EventKind): string {
  switch (k) {
    case 'weather':
      return 'blue';
    case 'port-status':
      return 'teal';
    case 'gps':
      return 'grape';
    case 'piracy':
      return 'red';
    case 'regulatory':
      return 'yellow';
    case 'demo':
      return 'meridian';
  }
}

function relTime(t: number): string {
  const delta = Date.now() - t;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}
