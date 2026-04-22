import { useEffect, useRef } from 'react';
import { useCesium } from 'resium';
import {
  ArcType,
  Cartesian2,
  Cartesian3,
  Color,
  Entity as CesiumEntity,
  PolylineDashMaterialProperty,
} from 'cesium';
import { useLayerStore } from '@/store/layers';
import { useSelectionStore } from '@/store/selection';
import { useLiveDataStore } from '@/store/liveData';
import { usePorts } from '@/hooks/usePorts';
import { matchPortFromDestination } from '@/lib/geo/matchPort';
import { categorizeShipType, vesselColor } from '@/types/vessel';

/**
 * Draws a great-circle "planned route" polyline from the selected vessel
 * to the port its AIS `destination` field resolves to. Mirrors the look of
 * the satellite orbit trace: a dashed polyline in the vessel's category
 * color, arcing over the globe.
 *
 * Only the currently-selected vessel gets a route — rendering all vessels'
 * intended tracks would paint the Earth solid. Selection is the affordance
 * that surfaces "where is this ship going?" on demand.
 *
 * Limitations:
 *   - AIS destinations are free-form crew text; we fuzzy-match against our
 *     curated ports list (~30 entries). Unmatched destinations show nothing.
 *   - The line is the great-circle chord, not a nav-routed track — vessels
 *     obviously don't sail over continents. Close enough for situational
 *     awareness; a real router would consult sea-lane GeoJSON.
 */
export function VesselRoutesLayer() {
  const { viewer } = useCesium();
  const enabled = useLayerStore((s) => s.layers.lanes.enabled);
  const selection = useSelectionStore((s) => s.selection);
  const vessels = useLiveDataStore((s) => s.vessels);
  const ports = usePorts();
  const routeRef = useRef<CesiumEntity | null>(null);
  const markerRef = useRef<CesiumEntity | null>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Clear prior entities on every change — re-add below if still valid.
    if (routeRef.current) {
      viewer.entities.remove(routeRef.current);
      routeRef.current = null;
    }
    if (markerRef.current) {
      viewer.entities.remove(markerRef.current);
      markerRef.current = null;
    }

    if (!enabled) return;
    if (selection?.kind !== 'vessel') return;
    const mmsi = Number(selection.id);
    if (!Number.isFinite(mmsi)) return;
    const vessel = vessels[mmsi];
    if (!vessel || vessel.lat == null || vessel.lon == null) return;

    const port = matchPortFromDestination(vessel.destination, ports);
    if (!port) return;

    const color = Color.fromCssColorString(
      vesselColor(categorizeShipType(vessel.shipType))
    );

    // Great-circle polyline from vessel → destination.
    const route = new CesiumEntity({
      id: `vessel-route:${mmsi}`,
      polyline: {
        positions: Cartesian3.fromDegreesArray([
          vessel.lon,
          vessel.lat,
          port.lon,
          port.lat,
        ]),
        width: 2,
        // Dashed so it reads as "planned" vs. historical track.
        material: new PolylineDashMaterialProperty({
          color: color.withAlpha(0.85),
          dashLength: 16,
        }),
        // GEODESIC = follow the ellipsoid surface. RHUMB would be a
        // constant-bearing line which is usually *longer*; great-circle
        // matches how ships actually plan long legs.
        arcType: ArcType.GEODESIC,
        // Sits just above terrain so it doesn't get buried by relief.
        clampToGround: false,
      },
    });
    viewer.entities.add(route);
    routeRef.current = route;

    // Destination pin — small marker so the endpoint is legible even when
    // the port icon isn't rendered (webcam layer may be off).
    const marker = new CesiumEntity({
      id: `vessel-route-dest:${mmsi}`,
      position: Cartesian3.fromDegrees(port.lon, port.lat),
      point: {
        pixelSize: 8,
        color: color.withAlpha(0.9),
        outlineColor: Color.fromCssColorString('#0B0D11'),
        outlineWidth: 1.5,
        disableDepthTestDistance: 5_000_000,
      },
      label: {
        text: `→ ${port.name}`,
        font: '11px "Geist Mono", monospace',
        fillColor: color,
        showBackground: true,
        backgroundColor: Color.fromCssColorString('#0B0D11').withAlpha(0.8),
        backgroundPadding: new Cartesian2(6, 3),
        pixelOffset: new Cartesian2(10, -6),
        disableDepthTestDistance: 5_000_000,
      },
    });
    viewer.entities.add(marker);
    markerRef.current = marker;

    return () => {
      if (routeRef.current) {
        viewer.entities.remove(routeRef.current);
        routeRef.current = null;
      }
      if (markerRef.current) {
        viewer.entities.remove(markerRef.current);
        markerRef.current = null;
      }
    };
  }, [viewer, enabled, selection, vessels, ports]);

  return null;
}
