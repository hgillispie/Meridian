# Meridian

> Global Logistics Intelligence, Live.

A browser-based 3D-globe mission control for global shipments — live vessels,
aircraft, Earth-observation satellites, port webcams, chokepoints, weather, and
disruption events, on one photorealistic Earth with a scrub-and-replay timeline.

**Status:** Phase 0 — scaffold. See [`~/.claude/plans/glistening-strolling-robin.md`](#)
for the phased build plan and [`~/Downloads/meridian-plan.md`](#) for the full spec.

## Stack

- React 18 + TypeScript + Vite
- CesiumJS via Resium (Phase 1)
- Mantine v7 (heavily customized — see [`src/theme.ts`](src/theme.ts))
- Zustand for state, TanStack Query for data
- pnpm + Vercel

## Local development

```bash
pnpm install
pnpm dev           # http://localhost:5173
pnpm build         # type-check + production bundle
pnpm test          # Vitest
pnpm lint          # ESLint
```

## Environment

Copy `.env.example` → `.env.local` and fill in whichever phase you're on.
Secret keys (Google Maps, AISStream, OpenSky) are read only by Vercel Edge
Functions in `api/*.ts` and never shipped to the client.

## Attribution

Meridian renders and fuses open data from Google Photorealistic 3D Tiles,
Cesium Ion, AISStream.io, OpenSky Network, CelesTrak, NOAA NWS, Open-Meteo,
IMB Piracy Reporting Centre, and UN/LOCODE. Each source retains its own
license and attribution — see the in-app credits overlay.
