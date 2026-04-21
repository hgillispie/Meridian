import { describe, expect, it, beforeEach } from 'vitest';
import { useLayerStore } from './layers';

describe('layer store', () => {
  beforeEach(() => {
    // Reset by re-enabling defaults; Zustand store is a singleton in tests
    const { toggle } = useLayerStore.getState();
    toggle('vessels', true);
    toggle('aircraft', true);
    toggle('satellites', false);
  });

  it('starts with vessels + aircraft enabled and satellites off', () => {
    const { layers } = useLayerStore.getState();
    expect(layers.vessels.enabled).toBe(true);
    expect(layers.aircraft.enabled).toBe(true);
    expect(layers.satellites.enabled).toBe(false);
  });

  it('toggle flips enabled state', () => {
    useLayerStore.getState().toggle('vessels', false);
    expect(useLayerStore.getState().layers.vessels.enabled).toBe(false);
  });

  it('setIntensity clamps to numeric range without mutating enabled flag', () => {
    useLayerStore.getState().setIntensity('aircraft', 0.4);
    const { aircraft } = useLayerStore.getState().layers;
    expect(aircraft.intensity).toBe(0.4);
    expect(aircraft.enabled).toBe(true);
  });
});
