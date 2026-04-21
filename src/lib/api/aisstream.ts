import type { Vessel } from '@/types/vessel';
import type { Bbox } from '@/lib/geo/bbox';

/**
 * AISStream.io WebSocket client.
 *
 * Protocol reference: https://aisstream.io/documentation
 *
 * Meridian uses a single persistent socket that is *reconfigured* as the
 * camera viewport changes, rather than opening/closing sockets on every
 * pan. The `subscribe` method pushes a new subscription frame; AISStream
 * cleanly switches filters on the existing connection.
 */

const ENDPOINT = 'wss://stream.aisstream.io/v0/stream';

type AisStreamMessage =
  | {
      MessageType: 'PositionReport';
      MetaData: {
        MMSI: number;
        ShipName?: string;
        latitude: number;
        longitude: number;
        time_utc: string;
      };
      Message: {
        PositionReport: {
          Cog?: number;
          Sog?: number;
          TrueHeading?: number;
          Latitude: number;
          Longitude: number;
          UserID: number;
          NavigationalStatus?: number;
        };
      };
    }
  | {
      MessageType: 'ShipStaticData';
      MetaData: {
        MMSI: number;
        ShipName?: string;
        latitude: number;
        longitude: number;
        time_utc: string;
      };
      Message: {
        ShipStaticData: {
          UserID: number;
          Name?: string;
          CallSign?: string;
          Type?: number;
          Destination?: string;
          Eta?: { Month?: number; Day?: number; Hour?: number; Minute?: number };
          Dimension?: { A?: number; B?: number; C?: number; D?: number };
          MaximumStaticDraught?: number;
          ImoNumber?: number;
        };
      };
    };

type SubscribeFrame = {
  APIKey: string;
  BoundingBoxes: [number, number][][]; // [[[south, west], [north, east]]]
  FiltersShipMMSI?: string[];
  FilterMessageTypes?: string[];
};

export type AisStreamClient = {
  subscribe: (bbox: Bbox) => void;
  close: () => void;
  /** Subscribe to vessel updates. Returns unsubscribe fn. */
  onVessel: (handler: (v: Vessel) => void) => () => void;
  /** Subscribe to connection-state changes. */
  onStatus: (handler: (s: 'connecting' | 'open' | 'closed' | 'error') => void) => () => void;
};

export function createAisStreamClient(apiKey: string): AisStreamClient {
  const vesselHandlers = new Set<(v: Vessel) => void>();
  const statusHandlers = new Set<(s: 'connecting' | 'open' | 'closed' | 'error') => void>();
  let ws: WebSocket | null = null;
  let pendingBbox: Bbox | null = null;
  let retryMs = 1000;
  let closed = false;

  function emitStatus(s: 'connecting' | 'open' | 'closed' | 'error') {
    statusHandlers.forEach((h) => h(s));
  }

  function buildFrame(bbox: Bbox): SubscribeFrame {
    // AISStream wants [[south,west],[north,east]] lat-first
    return {
      APIKey: apiKey,
      BoundingBoxes: [
        [
          [bbox.south, bbox.west],
          [bbox.north, bbox.east],
        ],
      ],
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    };
  }

  function connect() {
    if (closed) return;
    emitStatus('connecting');
    ws = new WebSocket(ENDPOINT);

    ws.addEventListener('open', () => {
      retryMs = 1000;
      emitStatus('open');
      if (pendingBbox) {
        ws?.send(JSON.stringify(buildFrame(pendingBbox)));
      }
    });

    ws.addEventListener('message', (ev) => {
      try {
        const parsed: AisStreamMessage = JSON.parse(ev.data as string);
        const vessel = toVessel(parsed);
        if (vessel) vesselHandlers.forEach((h) => h(vessel));
      } catch {
        // swallow — AISStream occasionally emits non-JSON ping frames
      }
    });

    ws.addEventListener('error', () => emitStatus('error'));

    ws.addEventListener('close', () => {
      emitStatus('closed');
      ws = null;
      if (!closed) {
        setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 30_000);
      }
    });
  }

  connect();

  return {
    subscribe(bbox) {
      pendingBbox = bbox;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(buildFrame(bbox)));
      }
    },
    close() {
      closed = true;
      ws?.close();
    },
    onVessel(handler) {
      vesselHandlers.add(handler);
      return () => {
        vesselHandlers.delete(handler);
      };
    },
    onStatus(handler) {
      statusHandlers.add(handler);
      return () => {
        statusHandlers.delete(handler);
      };
    },
  };
}

function toVessel(msg: AisStreamMessage): Vessel | null {
  const t = Date.parse(msg.MetaData.time_utc);
  if (Number.isNaN(t)) return null;

  if (msg.MessageType === 'PositionReport') {
    const p = msg.Message.PositionReport;
    return {
      mmsi: msg.MetaData.MMSI,
      t,
      lat: p.Latitude,
      lon: p.Longitude,
      cog: p.Cog,
      sog: p.Sog,
      heading: p.TrueHeading,
      name: msg.MetaData.ShipName?.trim() || undefined,
    };
  }

  if (msg.MessageType === 'ShipStaticData') {
    const s = msg.Message.ShipStaticData;
    const dim = s.Dimension;
    const length =
      dim?.A != null && dim?.B != null ? dim.A + dim.B : undefined;
    return {
      mmsi: msg.MetaData.MMSI,
      t,
      lat: msg.MetaData.latitude,
      lon: msg.MetaData.longitude,
      name: (s.Name || msg.MetaData.ShipName)?.trim() || undefined,
      callSign: s.CallSign?.trim() || undefined,
      imo: s.ImoNumber || undefined,
      shipType: s.Type,
      destination: s.Destination?.trim() || undefined,
      length,
      draft: s.MaximumStaticDraught,
    };
  }

  return null;
}
