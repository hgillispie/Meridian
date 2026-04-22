import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpotlightActionData, SpotlightActionGroupData } from '@mantine/spotlight';
import { useLiveDataStore } from '@/store/liveData';
import { useSatelliteStore } from '@/store/satellites';
import { useSelectionStore } from '@/store/selection';
import { flyTo } from '@/lib/globe/cameraApi';

type Port = {
  unlocode: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
};
type City = { name: string; country: string; lat: number; lon: number };

/**
 * Caps on how many live-feed entries we stuff into the action list.
 * Spotlight re-runs its fuzzy filter on every keystroke, so 1000+
 * vessels × 6 keyword strings is perceptibly janky. 75 per category is
 * well within the "recently-seen" window that matches §7.11 intent
 * (search the things actually on screen).
 */
const MAX_VESSELS = 75;
const MAX_AIRCRAFT = 75;
const MAX_SATELLITES = 200;

/**
 * Spotlight internally does `useEffect(() => ..., [actions])`. If we
 * hand it a freshly-allocated array on every render of the host — which
 * is what you get when the memo depends on the raw live-store records
 * that tick several times a second — Mantine explodes with
 * "Maximum update depth exceeded". Instead we snapshot the stores on a
 * 1.5s interval (enough that the user perceives the list as "live" but
 * Mantine sees a stable identity between cache ticks).
 */
const SNAPSHOT_MS = 1500;

/**
 * Build the Spotlight action list from our three live stores plus
 * static port/city JSON. Actions are grouped so users can see at a
 * glance which category a match came from; the `@port`, `@ship`,
 * `@plane`, `@sat`, `@city` keywords let you scope manually.
 *
 * Onclick behaviour:
 *   - Static (ports/cities): fly to lat/lon at a reasonable altitude.
 *   - Live entities: select them (right rail card opens) + fly to.
 */
export function useSpotlightActions(): (SpotlightActionData | SpotlightActionGroupData)[] {
  const select = useSelectionStore((s) => s.select);

  const [ports, setPorts] = useState<Port[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    void fetch('/data/ports.json')
      .then((r) => r.json() as Promise<{ ports: Port[] }>)
      .then((d) => setPorts(d.ports))
      .catch(() => setPorts([]));
    void fetch('/data/cities.json')
      .then((r) => r.json() as Promise<{ cities: City[] }>)
      .then((d) => setCities(d.cities))
      .catch(() => setCities([]));
  }, []);

  // Snapshot the live stores at a fixed cadence — NOT on every tick —
  // so that Spotlight sees a stable `actions` reference between snaps.
  const [snapshot, setSnapshot] = useState(() => ({
    vessels: useLiveDataStore.getState().vessels,
    aircraft: useLiveDataStore.getState().aircraft,
    satellites: useSatelliteStore.getState().byId,
  }));
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    const id = window.setInterval(() => {
      if (!mountedRef.current) return;
      setSnapshot({
        vessels: useLiveDataStore.getState().vessels,
        aircraft: useLiveDataStore.getState().aircraft,
        satellites: useSatelliteStore.getState().byId,
      });
    }, SNAPSHOT_MS);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, []);

  return useMemo(() => {
    const { vessels, aircraft, satellites } = snapshot;

    const portActions: SpotlightActionData[] = ports.map((p) => ({
      id: `port:${p.unlocode}`,
      label: p.name,
      description: `Port · ${p.country} · ${p.unlocode}`,
      keywords: ['@port', 'port', p.unlocode.toLowerCase(), p.country.toLowerCase()],
      onClick: () => {
        select({ kind: 'port', id: p.unlocode });
        flyTo(p.lon, p.lat, 150_000);
      },
    }));

    const cityActions: SpotlightActionData[] = cities.map((c) => ({
      id: `city:${c.name}`,
      label: c.name,
      description: `City · ${c.country}`,
      keywords: ['@city', 'city', c.country.toLowerCase()],
      onClick: () => flyTo(c.lon, c.lat, 300_000),
    }));

    // Live vessels — sort by most-recent position report so the freshest
    // signals rank highest when the query is ambiguous.
    const vesselList = Object.values(vessels)
      .filter((v) => v.name && v.lat != null && v.lon != null)
      .sort((a, b) => b.t - a.t)
      .slice(0, MAX_VESSELS);
    const vesselActions: SpotlightActionData[] = vesselList.map((v) => ({
      id: `vessel:${v.mmsi}`,
      label: v.name ?? `MMSI ${v.mmsi}`,
      description: `Vessel · MMSI ${v.mmsi}${v.callSign ? ` · ${v.callSign}` : ''}${
        v.destination ? ` → ${v.destination}` : ''
      }`,
      keywords: [
        '@ship',
        '@vessel',
        String(v.mmsi),
        v.callSign?.toLowerCase() ?? '',
        v.destination?.toLowerCase() ?? '',
      ],
      onClick: () => {
        select({ kind: 'vessel', id: String(v.mmsi) });
        if (v.lat != null && v.lon != null) flyTo(v.lon, v.lat, 50_000);
      },
    }));

    const aircraftList = Object.values(aircraft)
      .filter((a) => a.lat != null && a.lon != null)
      .slice(0, MAX_AIRCRAFT);
    const aircraftActions: SpotlightActionData[] = aircraftList.map((a) => ({
      id: `aircraft:${a.icao24}`,
      label: a.callsign?.trim() || a.icao24,
      description: `Aircraft · ICAO24 ${a.icao24}${
        a.originCountry ? ` · ${a.originCountry}` : ''
      }`,
      keywords: ['@plane', '@aircraft', a.icao24, a.callsign ?? ''],
      onClick: () => {
        select({ kind: 'aircraft', id: a.icao24 });
        if (a.lat != null && a.lon != null) flyTo(a.lon, a.lat, 50_000);
      },
    }));

    const satList = Object.values(satellites).slice(0, MAX_SATELLITES);
    const satActions: SpotlightActionData[] = satList.map((s) => ({
      id: `satellite:${s.noradId}`,
      label: s.name,
      description: `Satellite · NORAD ${s.noradId}${
        s.operator ? ` · ${s.operator}` : ''
      }${s.mission ? ` · ${s.mission}` : ''}`,
      keywords: [
        '@sat',
        '@satellite',
        String(s.noradId),
        s.operator?.toLowerCase() ?? '',
        s.mission?.toLowerCase() ?? '',
      ],
      onClick: () => {
        // Satellites rocket around — a `select()` is enough, the orbit
        // trace layer picks it up. We don't fly-to because the camera
        // can't really track a 7.5 km/s target without a follow mode.
        select({ kind: 'satellite', id: String(s.noradId) });
      },
    }));

    // Grouped output — Mantine renders a label for each group. Order
    // by cardinality so static, curated entries come first (less noise
    // in the default empty-query state).
    return [
      { group: 'Ports', actions: portActions },
      { group: 'Cities', actions: cityActions },
      { group: 'Vessels', actions: vesselActions },
      { group: 'Aircraft', actions: aircraftActions },
      { group: 'Satellites', actions: satActions },
    ];
  }, [ports, cities, snapshot, select]);
}
