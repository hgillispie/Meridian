import { useQuery } from '@tanstack/react-query';
import type { Bbox } from '@/lib/geo/bbox';
import { fetchStatesInBbox } from '@/lib/api/opensky';

/**
 * OpenSky ADS-B state poll. Cesium viewports can be huge (whole Pacific)
 * so we only activate when `enabled` is true and throttle to 5s.
 */
export function useOpenSky(bbox: Bbox, enabled: boolean) {
  return useQuery({
    queryKey: [
      'opensky',
      bbox.west.toFixed(2),
      bbox.south.toFixed(2),
      bbox.east.toFixed(2),
      bbox.north.toFixed(2),
    ],
    queryFn: ({ signal }) => fetchStatesInBbox(bbox, signal),
    enabled,
    refetchInterval: 5_000,
    staleTime: 4_500,
    retry: 1,
    retryDelay: 2_000,
    refetchOnWindowFocus: false,
  });
}
