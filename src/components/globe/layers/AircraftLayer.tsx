import { useEffect, useMemo, useState } from 'react';
import { useCesium } from 'resium';
import {
  Cartesian3,
  Color,
  Entity as CesiumEntity,
  HorizontalOrigin,
  Math as CesiumMath,
  VerticalOrigin,
} from 'cesium';
import { useOpenSky } from '@/hooks/useOpenSky';
import type { Bbox } from '@/lib/geo/bbox';
import { useLayerStore } from '@/store/layers';
import { useLiveDataStore } from '@/store/liveData';
import { useSelectionStore } from '@/store/selection';
import { aircraftMarker } from '@/lib/globe/markers';

type CargoPrefix = { icao: string; name: string };

export function AircraftLayer({ bbox }: { bbox: Bbox }) {
  const enabled = useLayerStore((s) => s.layers.aircraft.enabled);
  const intensity = useLayerStore((s) => s.layers.aircraft.intensity);
  const { viewer } = useCesium();
  const { data: aircraft = [] } = useOpenSky(bbox, enabled);
  const syncAircraft = useLiveDataStore((s) => s.syncAircraft);
  const setCargoIcaos = useLiveDataStore((s) => s.setCargoIcaos);
  const selection = useSelectionStore((s) => s.selection);
  const selectedIcao = selection?.kind === 'aircraft' ? selection.id : null;

  const [cargoPrefixes, setCargoPrefixes] = useState<CargoPrefix[]>([]);
  useEffect(() => {
    fetch('/data/cargo-airlines.json')
      .then((r) => r.json() as Promise<{ prefixes: CargoPrefix[] }>)
      .then((d) => setCargoPrefixes(d.prefixes))
      .catch(() => setCargoPrefixes([]));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    syncAircraft(aircraft);
  }, [aircraft, enabled, syncAircraft]);

  const cargoSet = useMemo(
    () => new Set(cargoPrefixes.map((p) => p.icao.toUpperCase())),
    [cargoPrefixes]
  );
  useEffect(() => {
    setCargoIcaos(cargoSet);
  }, [cargoSet, setCargoIcaos]);

  const entityMap = useMemo(() => new Map<string, CesiumEntity>(), []);

  useEffect(() => {
    if (!viewer) return;
    if (!enabled) {
      for (const e of entityMap.values()) viewer.entities.remove(e);
      entityMap.clear();
      return;
    }

    const seen = new Set<string>();
    for (const a of aircraft) {
      if (a.lat == null || a.lon == null) continue;
      seen.add(a.icao24);

      const isCargo = !!(
        a.callsign &&
        cargoSet.has(a.callsign.replace(/[^A-Z]/g, '').slice(0, 3).toUpperCase())
      );
      const color = isCargo ? '#00E5A8' : '#8892A0';
      const isSelected = selectedIcao === a.icao24;

      let entity = entityMap.get(a.icao24);
      const pos = Cartesian3.fromDegrees(a.lon, a.lat, a.altBaro ?? a.altGeo ?? 0);
      if (!entity) {
        entity = new CesiumEntity({
          id: `aircraft:${a.icao24}`,
          position: pos,
        });
        viewer.entities.add(entity);
        entityMap.set(a.icao24, entity);
      } else {
        entity.position = pos as unknown as typeof entity.position;
      }
      const rotationRad = CesiumMath.toRadians(-(a.heading ?? 0));
      entity.billboard = {
        image: aircraftMarker(color, isSelected, isCargo),
        rotation: rotationRad,
        alignedAxis: Cartesian3.ZERO,
        scale: isSelected ? 1.1 : isCargo ? 1.0 : 0.85,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        color: Color.WHITE.withAlpha(intensity),
        // Aircraft are airborne, so we only need a small near-camera buffer
        // against depth-glitches. Let the scene cull planes on the far side
        // of the globe instead of always rendering them on top.
        disableDepthTestDistance: 50_000,
      } as unknown as typeof entity.billboard;
    }

    for (const [id, entity] of entityMap) {
      if (!seen.has(id)) {
        viewer.entities.remove(entity);
        entityMap.delete(id);
      }
    }
  }, [viewer, aircraft, enabled, entityMap, cargoSet, selectedIcao, intensity]);

  return null;
}
