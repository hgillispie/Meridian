import type { SpotlightActionData } from '@mantine/spotlight';

/**
 * Phase 0 stub — Phase 4 wires this into real search sources
 * (UN/LOCODE, AIS cache, OpenSky states, CelesTrak, GeoNames).
 */
export function getSpotlightActions(): SpotlightActionData[] {
  return [
    {
      id: 'phase-placeholder',
      label: 'Search sources arrive in Phase 4',
      description: 'Ports, vessels, flights, satellites, cities',
      keywords: ['phase', 'search', 'placeholder'],
      onClick: () => {},
    },
  ];
}
