import { useEffect, useRef, useState } from 'react';
import { Paper, Group, Text, ActionIcon, Stack } from '@mantine/core';
import { GripVertical, X } from 'lucide-react';
import { useWebcamStore } from '@/store/webcams';
import { WebcamPlayer } from './WebcamPlayer';

/**
 * Floating picture-in-picture window pinned to the bottom-right of the
 * globe. Draggable by its header. Only one PiP at a time — the
 * `pipId` slot in the webcam store is the single source of truth.
 *
 * We intentionally don't use Mantine's Modal/Drawer: the PiP must NOT
 * block globe interaction. This is a bare positioned Paper with a drag
 * handler on the header strip.
 */
const INITIAL_WIDTH = 360;
const MARGIN = 16;

type Pos = { left: number; top: number };

export function WebcamPiP() {
  const pipId = useWebcamStore((s) => s.pipId);
  const webcams = useWebcamStore((s) => s.webcams);
  const setPip = useWebcamStore((s) => s.setPip);

  const webcam = pipId ? webcams.find((w) => w.id === pipId) ?? null : null;

  // Anchor in the bottom-right on first open; user drags from there.
  const [pos, setPos] = useState<Pos | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPos: Pos } | null>(
    null
  );

  useEffect(() => {
    if (!webcam) {
      setPos(null);
      return;
    }
    if (pos) return;
    // Default bottom-right, 16px off the edges, above the BottomDock
    // (~96px). Aspect ratio = 16:9 → height = width * 9/16.
    const w = INITIAL_WIDTH;
    const h = w * (9 / 16) + 36; // + header strip
    setPos({
      left: window.innerWidth - w - MARGIN,
      top: window.innerHeight - h - 96 - MARGIN,
    });
  }, [webcam, pos]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const next = {
        left: d.startPos.left + (e.clientX - d.startX),
        top: d.startPos.top + (e.clientY - d.startY),
      };
      // Clamp so the window can't leave the viewport entirely.
      const maxLeft = window.innerWidth - 120;
      const maxTop = window.innerHeight - 80;
      next.left = Math.max(-240, Math.min(maxLeft, next.left));
      next.top = Math.max(0, Math.min(maxTop, next.top));
      setPos(next);
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  if (!webcam || !pos) return null;

  return (
    <Paper
      withBorder
      shadow="lg"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        width: INITIAL_WIDTH,
        zIndex: 200,
        background: 'var(--meridian-bg)',
        borderColor: 'var(--meridian-border)',
        overflow: 'hidden',
      }}
    >
      <Group
        justify="space-between"
        gap="xs"
        px="xs"
        py={6}
        style={{
          cursor: 'grab',
          borderBottom: '1px solid var(--meridian-border)',
          userSelect: 'none',
        }}
        onPointerDown={(e) => {
          dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPos: pos,
          };
          (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLElement).style.cursor = 'grab';
        }}
      >
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          <GripVertical size={12} color="#64748B" />
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text size="xs" fw={600} lineClamp={1}>
              {webcam.title}
            </Text>
            <Text size="10px" c="dimmed" lineClamp={1}>
              {webcam.provider}
            </Text>
          </Stack>
        </Group>
        <ActionIcon
          size="xs"
          variant="subtle"
          color="gray"
          onClick={() => setPip(null)}
          aria-label="Close PiP"
        >
          <X size={12} />
        </ActionIcon>
      </Group>
      <WebcamPlayer webcam={webcam} size="large" />
    </Paper>
  );
}
