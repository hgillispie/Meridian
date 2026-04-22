import { useEffect, useMemo, useRef } from 'react';
import { useCesium } from 'resium';
import {
  CallbackProperty,
  Cartesian3,
  Color,
  Entity as CesiumEntity,
  HorizontalOrigin,
  VerticalOrigin,
} from 'cesium';
import {
  satelliteColor,
  type SatelliteCategory,
} from '@/types/satellite';
import { useLayerStore } from '@/store/layers';
import { useSatellites, filterCommercialEo } from '@/hooks/useSatellites';
import { useSatelliteStore } from '@/store/satellites';
import { useSelectionStore } from '@/store/selection';
import { satelliteMarker, satKindFromCategory } from '@/lib/globe/markers';
import {
  prepareSatrec,
  propagateToGeodetic,
  sampleOrbitPath,
  type PreparedSat,
} from '@/lib/orbit/propagate';

export function SatelliteLayer() {
  const enabled = useLayerStore((s) => s.layers.satellites.enabled);
  const { viewer } = useCesium();
  const { satellites } = useSatellites(enabled);
  const setSatellites = useSatelliteStore((s) => s.setSatellites);
  const selection = useSelectionStore((s) => s.selection);
  const selectedNorad =
    selection?.kind === 'satellite' ? Number(selection.id) : null;

  // Curate to commercial EO subset before rendering.
  const visible = useMemo(() => filterCommercialEo(satellites), [satellites]);

  // Mirror into zustand so SatelliteCard can look up selected by NORAD id.
  useEffect(() => {
    setSatellites(visible);
  }, [visible, setSatellites]);

  // Prepare SGP4 records once per satellite. Keyed by NORAD id.
  const preparedRef = useRef<Map<number, PreparedSat>>(new Map());
  useEffect(() => {
    const next = new Map<number, PreparedSat>();
    for (const sat of visible) {
      const existing = preparedRef.current.get(sat.noradId);
      if (existing) {
        next.set(sat.noradId, existing);
      } else {
        try {
          next.set(sat.noradId, prepareSatrec(sat));
        } catch {
          // skip invalid TLE
        }
      }
    }
    preparedRef.current = next;
  }, [visible]);

  // Entity bookkeeping — one billboard per satellite, one path per selected.
  const entityMap = useMemo(() => new Map<number, CesiumEntity>(), []);
  const traceRef = useRef<CesiumEntity | null>(null);

  // Add / remove billboards when the visible set or enabled flag changes.
  useEffect(() => {
    if (!viewer) return;

    if (!enabled) {
      for (const e of entityMap.values()) viewer.entities.remove(e);
      entityMap.clear();
      if (traceRef.current) {
        viewer.entities.remove(traceRef.current);
        traceRef.current = null;
      }
      return;
    }

    const seen = new Set<number>();
    for (const sat of visible) {
      seen.add(sat.noradId);
      const category: SatelliteCategory = sat.category ?? 'other';
      const color = satelliteColor(category);
      const isSelected = selectedNorad === sat.noradId;

      let entity = entityMap.get(sat.noradId);
      if (!entity) {
        // Position is a CallbackProperty so it resamples on every frame —
        // keeps the sat icon flowing along its orbit without us having to
        // re-render the React tree at 60Hz.
        const prepared = preparedRef.current.get(sat.noradId);
        const positionCb = new CallbackProperty(() => {
          const now = new Date();
          const p = prepared
            ? propagateToGeodetic(prepared, now)
            : null;
          if (!p) return Cartesian3.ZERO;
          return Cartesian3.fromDegrees(p.lon, p.lat, p.alt);
        }, false);

        entity = new CesiumEntity({
          id: `satellite:${sat.noradId}`,
          position: positionCb as unknown as CesiumEntity['position'],
        });
        viewer.entities.add(entity);
        entityMap.set(sat.noradId, entity);
      }

      // Re-set billboard each pass so the halo swaps in on selection
      // without having to recreate the entity (which would lose the
      // CallbackProperty position binding).
      entity.billboard = {
        image: satelliteMarker(color, satKindFromCategory(category), isSelected),
        scale: isSelected ? 1.05 : 0.95,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        color: Color.WHITE,
        // Satellites live hundreds of km up — we want the glyph to
        // always be visible without x-ray through the planet. Small
        // buffer against depth-test glitches at LEO altitude.
        disableDepthTestDistance: 100_000,
      } as unknown as typeof entity.billboard;
    }

    for (const [id, entity] of entityMap) {
      if (!seen.has(id)) {
        viewer.entities.remove(entity);
        entityMap.delete(id);
      }
    }
  }, [viewer, enabled, visible, entityMap, selectedNorad]);

  // Orbit trace — only drawn for the currently selected satellite.
  useEffect(() => {
    if (!viewer) return;
    if (traceRef.current) {
      viewer.entities.remove(traceRef.current);
      traceRef.current = null;
    }
    if (!enabled) return;
    if (selection?.kind !== 'satellite') return;
    const noradId = Number.parseInt(selection.id, 10);
    if (!Number.isFinite(noradId)) return;
    const sat = visible.find((s) => s.noradId === noradId);
    const prepared = preparedRef.current.get(noradId);
    if (!sat || !prepared) return;

    // ±1.1 orbits around now so we see the trace continuing out past
    // the satellite icon in both directions. 60s step keeps the path
    // cheap but smooth for LEO inclinations.
    const windowSec = Math.round((prepared.periodMin * 60) * 1.1);
    const positions = sampleOrbitPath(prepared, new Date(), windowSec, 60);
    if (positions.length < 2) return;

    const color = satelliteColor(sat.category ?? 'other');
    const trace = new CesiumEntity({
      id: `satellite-trace:${sat.noradId}`,
      polyline: {
        positions,
        width: 1.5,
        material: Color.fromCssColorString(color).withAlpha(0.7),
        arcType: 0, // none — positions are already in ECEF
      },
    });
    viewer.entities.add(trace);
    traceRef.current = trace;
  }, [viewer, enabled, visible, selection]);

  return null;
}
