/**
 * Marker glyph builders for the live-object layers (vessels, aircraft,
 * satellites). Each function returns a data-URI for a small SVG that
 * Cesium renders as a billboard.
 *
 * Visual direction (§5.2 "operations room after dark"):
 *   - Thin, precise strokes — no filled cartoon shapes.
 *   - Hollow geometric bodies with a 1.25 px accent stroke.
 *   - Every marker has a faint outer "sensor ring" to read as a
 *     radar blip at a glance.
 *   - Selected entities gain a brighter halo + 2 px outer ring at 40%
 *     opacity with a crosshair tick pair.
 *
 * All images are cached by (kind × color × variant) since there are
 * only ~10 unique combinations across the entire globe.
 */

type MarkerKey = string;

const cache = new Map<MarkerKey, string>();

function toDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Subtle translucent tint used for hollow marker fills. */
function tint(color: string, alpha = 0.18): string {
  // Support #RRGGBB hex inputs (the only form we use internally).
  if (!color.startsWith('#') || color.length !== 7) return color;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Halo ring + crosshair ticks for a selected entity, centered at (cx,cy). */
function selectionHalo(cx: number, cy: number, r: number, color: string): string {
  const tick = 2.5;
  return `
    <circle cx='${cx}' cy='${cy}' r='${r}' fill='none' stroke='${color}'
            stroke-width='1.25' stroke-opacity='0.75'/>
    <circle cx='${cx}' cy='${cy}' r='${r + 3}' fill='none' stroke='${color}'
            stroke-width='0.6' stroke-opacity='0.4'/>
    <line x1='${cx - r - 4}' y1='${cy}' x2='${cx - r - 4 + tick}' y2='${cy}'
          stroke='${color}' stroke-width='1'/>
    <line x1='${cx + r + 4 - tick}' y1='${cy}' x2='${cx + r + 4}' y2='${cy}'
          stroke='${color}' stroke-width='1'/>
    <line x1='${cx}' y1='${cy - r - 4}' x2='${cx}' y2='${cy - r - 4 + tick}'
          stroke='${color}' stroke-width='1'/>
    <line x1='${cx}' y1='${cy + r + 4 - tick}' x2='${cx}' y2='${cy + r + 4}'
          stroke='${color}' stroke-width='1'/>
  `;
}

// --------------------------------------------------------------------
// Vessels
// --------------------------------------------------------------------

/**
 * A hollow top-down ship silhouette: tapered bow, flat stern, thin accent
 * stroke. 18×24 canvas so the long axis is vertical (heading rotates the
 * billboard, so "up" = bow).
 */
export function vesselMarker(color: string, selected: boolean): string {
  const key = `vessel:${color}:${selected ? 's' : 'n'}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const halo = selected ? selectionHalo(12, 12, 10, color) : '';
  // Hull: a rounded-rect with a pointed bow. Drawn vertical (bow up).
  const hull = `
    <path d='M12 2 L16 7 L16 19 Q16 21 14 21 L10 21 Q8 21 8 19 L8 7 Z'
          fill='${tint(color, 0.22)}' stroke='${color}' stroke-width='1.25'
          stroke-linejoin='round'/>
    <line x1='12' y1='10' x2='12' y2='18' stroke='${color}' stroke-width='0.6'
          stroke-opacity='0.5'/>
  `;

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
    ${halo}
    ${hull}
  </svg>`;
  const uri = toDataUri(svg);
  cache.set(key, uri);
  return uri;
}

// --------------------------------------------------------------------
// Aircraft
// --------------------------------------------------------------------

/**
 * A stylized aircraft mark: thin cross with wingtip dots, a pointed nose,
 * and a short tail dash. 26×26 canvas, nose up (heading rotation handled
 * by the caller).
 *
 * `isCargo` thickens the stroke and gives it the mint accent fill so
 * cargo birds pop in the same way the plan §7.3 calls out.
 */
export function aircraftMarker(color: string, selected: boolean, isCargo: boolean): string {
  const key = `aircraft:${color}:${selected ? 's' : 'n'}:${isCargo ? 'c' : 'p'}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const halo = selected ? selectionHalo(13, 13, 10, color) : '';
  const stroke = isCargo ? 1.4 : 1.1;
  const fill = isCargo ? tint(color, 0.32) : tint(color, 0.15);

  const body = `
    <!-- fuselage (nose at top) -->
    <path d='M13 3 L15 10 L15 17 L14.5 20 L13 21 L11.5 20 L11 17 L11 10 Z'
          fill='${fill}' stroke='${color}' stroke-width='${stroke}' stroke-linejoin='round'/>
    <!-- wings: thin horizontal bar -->
    <line x1='3' y1='13' x2='23' y2='13' stroke='${color}' stroke-width='${stroke}'
          stroke-linecap='round'/>
    <!-- wingtip dots -->
    <circle cx='3' cy='13' r='1.2' fill='${color}'/>
    <circle cx='23' cy='13' r='1.2' fill='${color}'/>
    <!-- tailplane -->
    <line x1='10' y1='20' x2='16' y2='20' stroke='${color}' stroke-width='${stroke - 0.2}'
          stroke-linecap='round'/>
    <!-- nose dot -->
    <circle cx='13' cy='3' r='1' fill='${color}'/>
  `;

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'>
    ${halo}
    ${body}
  </svg>`;
  const uri = toDataUri(svg);
  cache.set(key, uri);
  return uri;
}

// --------------------------------------------------------------------
// Satellites
// --------------------------------------------------------------------

export type SatMarkerKind = 'optical' | 'radar' | 'other';

/**
 * A reticle with concentric rings + tick marks. Optical sats get a small
 * aperture-notch tick at top; SAR sats get a pulse-arc to signify radar.
 * 24×24 canvas; NOT rotated by heading (satellite tracks are too fast for
 * heading-on-glyph to read anyway).
 */
export function satelliteMarker(
  color: string,
  kind: SatMarkerKind,
  selected: boolean
): string {
  const key = `sat:${color}:${kind}:${selected ? 's' : 'n'}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const cx = 12;
  const cy = 12;
  const halo = selected ? selectionHalo(cx, cy, 8, color) : '';

  // Inner core + ring for every sat
  const base = `
    <circle cx='${cx}' cy='${cy}' r='6' fill='${tint(color, 0.1)}' stroke='${color}'
            stroke-width='1' stroke-opacity='0.85'/>
    <circle cx='${cx}' cy='${cy}' r='1.6' fill='${color}'/>
    <!-- N / S / E / W ticks -->
    <line x1='${cx}' y1='${cy - 8}' x2='${cx}' y2='${cy - 6.5}' stroke='${color}' stroke-width='1'/>
    <line x1='${cx}' y1='${cy + 6.5}' x2='${cx}' y2='${cy + 8}' stroke='${color}' stroke-width='1'/>
    <line x1='${cx - 8}' y1='${cy}' x2='${cx - 6.5}' y2='${cy}' stroke='${color}' stroke-width='1'/>
    <line x1='${cx + 6.5}' y1='${cy}' x2='${cx + 8}' y2='${cy}' stroke='${color}' stroke-width='1'/>
  `;

  // Kind-specific embellishment
  let kindMark = '';
  if (kind === 'optical') {
    // Small aperture triangle at NE quadrant
    kindMark = `<path d='M${cx + 4} ${cy - 4} L${cx + 6} ${cy - 6} L${cx + 6} ${cy - 4} Z'
                       fill='${color}' fill-opacity='0.85'/>`;
  } else if (kind === 'radar') {
    // Radar pulse — two arcs at NE
    kindMark = `
      <path d='M${cx + 3} ${cy - 5} A 2 2 0 0 1 ${cx + 5} ${cy - 3}' fill='none'
            stroke='${color}' stroke-width='1' stroke-linecap='round'/>
      <path d='M${cx + 2} ${cy - 7} A 4 4 0 0 1 ${cx + 7} ${cy - 2}' fill='none'
            stroke='${color}' stroke-width='0.8' stroke-opacity='0.6' stroke-linecap='round'/>
    `;
  }

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
    ${halo}
    ${base}
    ${kindMark}
  </svg>`;
  const uri = toDataUri(svg);
  cache.set(key, uri);
  return uri;
}

/** Map our `SatelliteCategory` to the marker's narrower "kind". */
export function satKindFromCategory(
  cat: 'eo-optical' | 'eo-radar' | 'eo-other' | 'comms' | 'nav' | 'science' | 'other'
): SatMarkerKind {
  if (cat === 'eo-optical') return 'optical';
  if (cat === 'eo-radar') return 'radar';
  return 'other';
}
