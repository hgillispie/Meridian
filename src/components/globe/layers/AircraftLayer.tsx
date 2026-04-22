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

type CargoPrefix = { icao: string; name: string };

const planeSvgCache = new Map<string, string>();
function planeSvg(color: string): string {
  const cached = planeSvgCache.get(color);
  if (cached) return cached;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 18 18'>
    <path d='M9 1 L10 7 L17 9 L17 10 L10 11 L10 14 L12 15 L12 16 L9 15.5 L6 16 L6 15 L8 14 L8 11 L1 10 L1 9 L8 7 Z'
          fill='${color}' stroke='#07090D' stroke-width='0.6' stroke-linejoin='round'/>
  </svg>`;
  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  planeSvgCache.set(color, uri);
  return uri;
}

export function AircraftLayer({ bbox }: { bbox: Bbox }) {
  const enabled = useLayerStore((s) => s.layers.aircraft.enabled);
  const { viewer } = useCesium();
  const { data: aircraft = [] } = useOpenSky(bbox, enabled);
  const syncAircraft = useLiveDataStore((s) => s.syncAircraft);
  const setCargoIcaos = useLiveDataStore((s) => s.setCargoIcaos);

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

      const isCargo =
        a.callsign &&
        cargoSet.has(a.callsign.replace(/[^A-Z]/g, '').slice(0, 3).toUpperCase());
      const color = isCargo ? '#00E5A8' : '#8892A0';

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
        image: planeSvg(color),
        rotation: rotationRad,
        alignedAxis: Cartesian3.ZERO,
        scale: isCargo ? 1.1 : 0.85,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        color: Color.WHITE,
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
  }, [viewer, aircraft, enabled, entityMap, cargoSet]);

  return null;
}
