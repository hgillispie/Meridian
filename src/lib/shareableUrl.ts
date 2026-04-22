import {
  Cartesian3,
  Math as CesiumMath,
  type Viewer,
} from 'cesium';
import { useLayerStore, type LayerId } from '@/store/layers';
import { useClockStore } from '@/store/clock';
import { useViewModeStore, type ViewMode } from '@/store/viewMode';
import {
  useSelectionStore,
  type Selection,
  type SelectionKind,
} from '@/store/selection';

/**
 * `#v1=…` hash encoding for everything a user might reasonably want to
 * share: camera pose, clock state, layer toggles, view mode, selection.
 *
 * Shape is a compact pipe-delimited string to keep URLs short:
 *
 *   v1=lon,lat,alt|heading,pitch|pos,speed,playing|layers|mode|sel
 *
 * where:
 *   - lon,lat in degrees (4dp), alt in meters (int)
 *   - heading,pitch in degrees (int, signed)
 *   - pos = hours offset from now (2dp), speed = 1|10|100, playing = 0|1
 *   - layers = base36 bitmap (LAYER_ORDER indexed)
 *   - mode = 'd'|'n'|'h'|'b'|'r' (daylight/nightops/density/blueprint/retro)
 *   - sel = 'kind:id' or '-'
 */

export const HASH_PREFIX = 'v1=';

const LAYER_ORDER: LayerId[] = [
  'vessels',
  'aircraft',
  'satellites',
  'webcams',
  'gps',
  'disruptions',
  'lanes',
  'chokepoints',
  'weather',
  'traffic',
];

const MODE_SHORT: Record<ViewMode, string> = {
  daylight: 'd',
  nightops: 'n',
  density: 'h',
  blueprint: 'b',
  retro: 'r',
};
const MODE_LONG = Object.fromEntries(
  Object.entries(MODE_SHORT).map(([k, v]) => [v, k as ViewMode])
) as Record<string, ViewMode>;

const SEL_KINDS: readonly SelectionKind[] = [
  'vessel',
  'aircraft',
  'satellite',
  'port',
  'chokepoint',
];

// ---------------- camera ----------------

export type CameraPose = {
  lon: number;
  lat: number;
  alt: number;
  heading: number;
  pitch: number;
};

export function readCameraPose(viewer: Viewer): CameraPose | null {
  const pos = viewer.camera.positionCartographic;
  if (!pos) return null;
  return {
    lon: CesiumMath.toDegrees(pos.longitude),
    lat: CesiumMath.toDegrees(pos.latitude),
    alt: pos.height,
    heading: CesiumMath.toDegrees(viewer.camera.heading),
    pitch: CesiumMath.toDegrees(viewer.camera.pitch),
  };
}

export function flyToPose(viewer: Viewer, pose: CameraPose, durationSec = 1.4) {
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(pose.lon, pose.lat, pose.alt),
    orientation: {
      heading: CesiumMath.toRadians(pose.heading),
      pitch: CesiumMath.toRadians(pose.pitch),
      roll: 0,
    },
    duration: durationSec,
  });
}

// ---------------- encode ----------------

type AppSnapshot = {
  camera: CameraPose | null;
  clock: { position: number; speed: number; playing: boolean };
  layers: Record<LayerId, { enabled: boolean }>;
  mode: ViewMode;
  selection: Selection | null;
};

export function encodeSnapshot(snap: AppSnapshot): string {
  const { camera, clock, layers, mode, selection } = snap;
  const camStr = camera
    ? `${camera.lon.toFixed(4)},${camera.lat.toFixed(4)},${Math.round(camera.alt)}`
    : '-';
  const orientStr = camera
    ? `${Math.round(camera.heading)},${Math.round(camera.pitch)}`
    : '-';
  const clockStr = `${clock.position.toFixed(2)},${clock.speed},${clock.playing ? 1 : 0}`;
  // Pack layers as a bitmap; LSB = LAYER_ORDER[0].
  let layerBits = 0;
  for (let i = 0; i < LAYER_ORDER.length; i++) {
    if (layers[LAYER_ORDER[i]]?.enabled) layerBits |= 1 << i;
  }
  const layerStr = layerBits.toString(36);
  const modeStr = MODE_SHORT[mode];
  const selStr = selection ? `${selection.kind}:${selection.id}` : '-';
  return `v1=${camStr}|${orientStr}|${clockStr}|${layerStr}|${modeStr}|${selStr}`;
}

// ---------------- decode ----------------

export type DecodedSnapshot = Partial<AppSnapshot>;

export function decodeSnapshot(raw: string): DecodedSnapshot | null {
  // Input arrives as either `v1=…` or the raw `…` payload (when the
  // caller has already stripped the prefix).
  const payload = raw.startsWith(HASH_PREFIX) ? raw.slice(HASH_PREFIX.length) : raw;
  const parts = payload.split('|');
  if (parts.length < 6) return null;

  const out: DecodedSnapshot = {};

  if (parts[0] !== '-') {
    const [lon, lat, alt] = parts[0].split(',').map(Number);
    if (Number.isFinite(lon) && Number.isFinite(lat) && Number.isFinite(alt)) {
      const heading = parts[1] !== '-' ? Number(parts[1].split(',')[0]) : 0;
      const pitch = parts[1] !== '-' ? Number(parts[1].split(',')[1]) : -65;
      out.camera = { lon, lat, alt, heading, pitch };
    }
  }

  const [posStr, speedStr, playStr] = parts[2].split(',');
  const position = Number(posStr);
  const speed = Number(speedStr);
  if (Number.isFinite(position) && (speed === 1 || speed === 10 || speed === 100)) {
    out.clock = {
      position,
      speed,
      playing: playStr === '1',
    };
  }

  const bits = Number.parseInt(parts[3], 36);
  if (Number.isFinite(bits)) {
    const layers: Record<string, { enabled: boolean }> = {};
    for (let i = 0; i < LAYER_ORDER.length; i++) {
      layers[LAYER_ORDER[i]] = { enabled: (bits & (1 << i)) !== 0 };
    }
    out.layers = layers as Record<LayerId, { enabled: boolean }>;
  }

  const modeRaw = parts[4];
  if (modeRaw in MODE_LONG) out.mode = MODE_LONG[modeRaw];

  if (parts[5] !== '-') {
    const [kind, ...rest] = parts[5].split(':');
    const id = rest.join(':');
    if ((SEL_KINDS as readonly string[]).includes(kind) && id) {
      out.selection = { kind: kind as SelectionKind, id };
    }
  }

  return out;
}

// ---------------- apply (decode → stores + camera) ----------------

export function applySnapshot(viewer: Viewer | null, snap: DecodedSnapshot): void {
  if (snap.camera && viewer) {
    flyToPose(viewer, snap.camera, 0);
  }
  if (snap.clock) {
    useClockStore.setState({
      position: snap.clock.position,
      speed: snap.clock.speed as 1 | 10 | 100,
      playing: snap.clock.playing,
    });
  }
  if (snap.layers) {
    const current = useLayerStore.getState().layers;
    const next = { ...current };
    for (const id of LAYER_ORDER) {
      if (snap.layers[id]) {
        next[id] = { ...current[id], enabled: snap.layers[id].enabled };
      }
    }
    useLayerStore.setState({ layers: next });
  }
  if (snap.mode) {
    useViewModeStore.setState({ mode: snap.mode });
  }
  if (snap.selection !== undefined) {
    useSelectionStore.setState({ selection: snap.selection });
  }
}

// ---------------- snapshot current state ----------------

export function snapshotState(viewer: Viewer | null): AppSnapshot {
  const camera = viewer ? readCameraPose(viewer) : null;
  const clock = useClockStore.getState();
  const layers = useLayerStore.getState().layers;
  const mode = useViewModeStore.getState().mode;
  const selection = useSelectionStore.getState().selection;
  return {
    camera,
    clock: { position: clock.position, speed: clock.speed, playing: clock.playing },
    layers,
    mode,
    selection,
  };
}
