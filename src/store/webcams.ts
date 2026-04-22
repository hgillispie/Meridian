import { create } from 'zustand';

/**
 * Port webcam directory state — loaded once from
 * `public/data/port-webcams.json`. Source types:
 *
 *  - `youtube` — `src` is a full embed URL. Rendered in an iframe; we
 *    cannot sample the frame into a WebGL texture (YouTube sandboxes it)
 *    so iframe-mode entries are PiP-only.
 *  - `hls`     — `src` is a direct `.m3u8` URL. Played via hls.js in a
 *    `<video>` element; can be WebGL-textured if the stream is CORS-OK.
 *  - `image`   — `src` is a still image. We refresh it periodically so
 *    it feels quasi-live.
 *
 * A single PiP window is allowed at a time (`pipId`). Selecting a port
 * auto-opens the hero webcam for that port.
 */
export type WebcamType = 'youtube' | 'hls' | 'image';

export type Webcam = {
  id: string;
  portCode: string;
  title: string;
  provider: string;
  type: WebcamType;
  src: string;
  /** [lon, lat] — camera pin position on the globe. */
  location: [number, number];
  /** Mark this webcam as the primary for hero-port demos. */
  hero?: boolean;
  description?: string;
  attribution?: string;
};

type WebcamStore = {
  webcams: Webcam[];
  loaded: boolean;
  /** Currently PiP'd webcam id, or null. */
  pipId: string | null;
  setWebcams: (w: Webcam[]) => void;
  setPip: (id: string | null) => void;
};

export const useWebcamStore = create<WebcamStore>((set) => ({
  webcams: [],
  loaded: false,
  pipId: null,
  setWebcams: (webcams) => set({ webcams, loaded: true }),
  setPip: (pipId) => set({ pipId }),
}));

/** Webcams indexed by their parent UN/LOCODE port. */
export function webcamsByPort(
  webcams: Webcam[]
): Record<string, Webcam[]> {
  const out: Record<string, Webcam[]> = {};
  for (const w of webcams) {
    (out[w.portCode] ??= []).push(w);
  }
  return out;
}

/** Pick the "hero" webcam for a port, or the first if none marked. */
export function heroWebcam(webcams: Webcam[], portCode: string): Webcam | null {
  const forPort = webcams.filter((w) => w.portCode === portCode);
  return forPort.find((w) => w.hero) ?? forPort[0] ?? null;
}
