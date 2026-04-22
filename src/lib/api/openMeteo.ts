import type { Disruption } from '@/store/disruptions';

/**
 * Open-Meteo "Marine Weather" returns gridded forecast data but not
 * point alerts. For Phase 5 we sample a handful of hero chokepoints and
 * emit a disruption when sustained winds exceed a threshold. This keeps
 * the layer interesting even when no "real" storm alert is live.
 *
 * No key needed — the public API is rate-limited per IP.
 */

const SAMPLE_POINTS: Array<{ id: string; name: string; lon: number; lat: number }> = [
  { id: 'suez-approach', name: 'Suez approaches', lon: 32.55, lat: 31.2 },
  { id: 'malacca-mid', name: 'Malacca mid-strait', lon: 100.5, lat: 3.0 },
  { id: 'hormuz', name: 'Strait of Hormuz', lon: 56.5, lat: 26.6 },
  { id: 'cape-horn', name: 'Drake Passage', lon: -67.0, lat: -56.0 },
  { id: 'bering', name: 'Bering Sea', lon: -175.0, lat: 58.0 },
];

const WIND_THRESHOLD_KTS = 35;

type MarineResponse = {
  hourly: {
    time: string[];
    wind_speed_10m?: number[];
  };
};

/**
 * Pull 24-h marine forecasts for the sample points and synthesize a
 * disruption for anywhere the peak wind exceeds `WIND_THRESHOLD_KTS`.
 *
 * Each synthesized disruption is a ~1° square centered on the sample
 * point — good enough to read as context without claiming precision.
 */
export async function fetchOpenMeteoStorms(): Promise<Disruption[]> {
  const out: Disruption[] = [];
  await Promise.all(
    SAMPLE_POINTS.map(async (pt) => {
      try {
        const url = new URL('https://marine-api.open-meteo.com/v1/marine');
        url.searchParams.set('latitude', String(pt.lat));
        url.searchParams.set('longitude', String(pt.lon));
        url.searchParams.set('hourly', 'wave_height');
        url.searchParams.set('forecast_days', '2');
        const marineRes = await fetch(url.toString());
        if (!marineRes.ok) return;
        // We also want wind — the marine API has wave but not wind, so
        // hit the forecast API for wind_speed_10m at the same point.
        const windUrl = new URL('https://api.open-meteo.com/v1/forecast');
        windUrl.searchParams.set('latitude', String(pt.lat));
        windUrl.searchParams.set('longitude', String(pt.lon));
        windUrl.searchParams.set('hourly', 'wind_speed_10m');
        windUrl.searchParams.set('wind_speed_unit', 'kn');
        windUrl.searchParams.set('forecast_days', '2');
        const windRes = await fetch(windUrl.toString());
        if (!windRes.ok) return;
        const wind = (await windRes.json()) as MarineResponse;
        const speeds = wind.hourly.wind_speed_10m ?? [];
        let peak = 0;
        let peakIdx = 0;
        for (let i = 0; i < speeds.length; i++) {
          if (speeds[i] > peak) {
            peak = speeds[i];
            peakIdx = i;
          }
        }
        if (peak >= WIND_THRESHOLD_KTS) {
          const peakTime = wind.hourly.time[peakIdx];
          out.push({
            id: `openmeteo:${pt.id}`,
            kind: 'weather',
            severity: peak >= 50 ? 'high' : peak >= 40 ? 'moderate' : 'low',
            title: `${pt.name} — sustained ${Math.round(peak)} kn winds`,
            detail: `Peak forecast at ${new Date(peakTime).toISOString().slice(0, 16).replace('T', ' ')} UTC. Source: Open-Meteo.`,
            startedAt: Date.now(),
            endedAt: Date.parse(peakTime) + 6 * 3600 * 1000,
            polygon: boxAround(pt.lon, pt.lat, 0.8),
            center: [pt.lon, pt.lat],
            source: 'Open-Meteo',
          });
        }
      } catch {
        // best-effort — silent on network failure
      }
    })
  );
  return out;
}

function boxAround(lon: number, lat: number, halfSpan: number): number[][] {
  return [
    [lon - halfSpan, lat - halfSpan],
    [lon + halfSpan, lat - halfSpan],
    [lon + halfSpan, lat + halfSpan],
    [lon - halfSpan, lat + halfSpan],
    [lon - halfSpan, lat - halfSpan],
  ];
}
