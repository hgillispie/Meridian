import { useEffect, useRef, useState } from 'react';
import { Box, Text, Stack } from '@mantine/core';
import { VideoOff } from 'lucide-react';
import type { Webcam } from '@/store/webcams';

/**
 * Re-renders `src` at this cadence for `type: 'image'` webcams so the
 * still photo feels live. Value tuned so that we don't hammer Wikimedia
 * thumbnails (they're cached aggressively anyway — the cachebuster just
 * forces the browser to re-request when the CDN TTL expires).
 */
const IMAGE_REFRESH_MS = 30_000;

type Props = {
  webcam: Webcam;
  /**
   * Small = thumbnail-mode used inside the RightRail PortCard. Large =
   * the PiP window. Only affects the aspect-ratio container; the player
   * itself fills available width.
   */
  size?: 'small' | 'large';
  /** Muted iframe/video — always true for autoplay reliability. */
  muted?: boolean;
};

/**
 * Polymorphic webcam player. Picks a renderer based on `webcam.type`:
 *
 *  - `youtube` → iframe with autoplay + mute. Works for both direct
 *     video IDs (src contains `/embed/<id>`) and latest-live links
 *     (src contains `/embed/live_stream?channel=<ch>`).
 *  - `hls`     → `<video>` element with hls.js attached. Falls back to
 *     native playback on Safari (which speaks HLS natively). Errors
 *     surface a "Stream unavailable" panel.
 *  - `image`   → `<img>` with a 30s cachebuster refresh loop.
 *
 * All three render 16:9 at the container's width.
 */
export function WebcamPlayer({ webcam, size = 'small', muted = true }: Props) {
  if (webcam.type === 'youtube') {
    return <YouTubePlayer webcam={webcam} size={size} muted={muted} />;
  }
  if (webcam.type === 'hls') {
    return <HlsPlayer webcam={webcam} size={size} muted={muted} />;
  }
  return <ImagePlayer webcam={webcam} size={size} />;
}

function YouTubePlayer({ webcam, muted }: Props) {
  const url = new URL(webcam.src);
  // Force autoplay + mute + no-related-videos regardless of what the
  // curated URL ships with.
  url.searchParams.set('autoplay', '1');
  url.searchParams.set('mute', muted ? '1' : '0');
  url.searchParams.set('rel', '0');
  url.searchParams.set('modestbranding', '1');
  return (
    <Frame>
      <iframe
        title={webcam.title}
        src={url.toString()}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        style={{
          border: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </Frame>
  );
}

function HlsPlayer({ webcam, muted }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(false);

    let hls: { destroy: () => void } | null = null;
    let cancelled = false;

    // Safari / iOS natively play HLS — skip the hls.js path there.
    const canPlayNative = video.canPlayType('application/vnd.apple.mpegurl');

    if (canPlayNative) {
      video.src = webcam.src;
    } else {
      // Dynamic import so hls.js is only pulled in when we actually
      // encounter an HLS source. Keeps the initial bundle lean.
      void import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setError(true);
          return;
        }
        const instance = new Hls({ enableWorker: true, lowLatencyMode: true });
        instance.loadSource(webcam.src);
        instance.attachMedia(video);
        instance.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setError(true);
        });
        hls = instance;
      }).catch(() => setError(true));
    }

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [webcam.src]);

  if (error) {
    return (
      <Frame>
        <Unavailable reason="Stream offline" />
      </Frame>
    );
  }

  return (
    <Frame>
      <video
        ref={videoRef}
        autoPlay
        muted={muted}
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </Frame>
  );
}

function ImagePlayer({ webcam }: Props) {
  const [ts, setTs] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setTs(Date.now()), IMAGE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  // Wikimedia responds with CORS + strong caching; the `?t=` param is
  // a trivial cachebuster for when we want the CDN to re-validate.
  const sep = webcam.src.includes('?') ? '&' : '?';
  const src = `${webcam.src}${sep}t=${Math.floor(ts / IMAGE_REFRESH_MS)}`;

  if (failed) {
    return (
      <Frame>
        <Unavailable reason="Image unavailable" />
      </Frame>
    );
  }

  return (
    <Frame>
      <img
        src={src}
        alt={webcam.title}
        onError={() => setFailed(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </Frame>
  );
}

/**
 * 16:9 container with a subtle border so the player sits cleanly in
 * both the RightRail and the PiP window without the child element
 * needing to know anything about layout.
 */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <Box
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        background: '#000',
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid var(--meridian-border)',
      }}
    >
      {children}
    </Box>
  );
}

function Unavailable({ reason }: { reason: string }) {
  return (
    <Stack
      align="center"
      justify="center"
      gap={4}
      style={{ width: '100%', height: '100%' }}
    >
      <VideoOff size={20} color="#64748B" />
      <Text size="xs" c="dimmed">
        {reason}
      </Text>
    </Stack>
  );
}
