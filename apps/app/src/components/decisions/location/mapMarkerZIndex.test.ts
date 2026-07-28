/**
 * Pin the stacking contract for map markers: the active pin must sit above
 * its neighbours, and an inactive pin must return an explicit resetting value
 * (not `undefined`) so a previously-active pin can't stay stuck on top.
 */
import { getMapMarkerZIndex } from '@op/ui/MapMarker';
import { describe, expect, it } from 'vitest';

describe('getMapMarkerZIndex', () => {
  it('lifts the active pin above its neighbours', () => {
    expect(getMapMarkerZIndex(true)).toBeGreaterThan(getMapMarkerZIndex(false));
  });

  it('resets an inactive pin to an explicit 0, never undefined', () => {
    // react-map-gl skips applying an `undefined` style, so an inactive pin
    // must carry a concrete 0 to clear any lift it had while active.
    expect(getMapMarkerZIndex(false)).toBe(0);
  });
});
