import { useEffect, useState } from 'react';

export type PortRecord = {
  unlocode: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
};

let portsCache: PortRecord[] | null = null;
let inflight: Promise<PortRecord[]> | null = null;

async function loadPorts(): Promise<PortRecord[]> {
  if (portsCache) return portsCache;
  if (inflight) return inflight;
  inflight = fetch('/data/ports.json')
    .then((r) => r.json() as Promise<{ ports: PortRecord[] }>)
    .then((d) => {
      portsCache = d.ports;
      return d.ports;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Hook form — load once per page, share result across consumers. */
export function usePorts(): PortRecord[] {
  const [ports, setPorts] = useState<PortRecord[]>(portsCache ?? []);
  useEffect(() => {
    if (portsCache) return;
    let cancelled = false;
    void loadPorts().then((p) => {
      if (!cancelled) setPorts(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ports;
}
