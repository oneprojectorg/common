/**
 * Pin the edge cases of the pure placement helper — fits, flips, just-fits,
 * cramped container, caller-supplied gap/buffer.
 */
import { getMapPinHovercardPlacement } from '@op/sense/Map';
import { describe, expect, it } from 'vitest';

describe('getMapPinHovercardPlacement', () => {
  it('renders above when the card fits above the pin head', () => {
    const placement = getMapPinHovercardPlacement({
      pinHeadTopPx: 200,
      pinTipPx: 232,
      cardHeightPx: 140,
      mapHeightPx: 600,
    });

    expect(placement).toBe('top');
  });

  it('flips below when the pin is near the top edge', () => {
    const placement = getMapPinHovercardPlacement({
      pinHeadTopPx: 4,
      pinTipPx: 36,
      cardHeightPx: 140,
      mapHeightPx: 600,
    });

    expect(placement).toBe('bottom');
  });

  it('stays above on an exact fit (no spurious flip)', () => {
    // pinHeadTopPx − gap(8) − card(140) === buffer(8) → exactly fits.
    const placement = getMapPinHovercardPlacement({
      pinHeadTopPx: 156,
      pinTipPx: 188,
      cardHeightPx: 140,
      mapHeightPx: 600,
    });

    expect(placement).toBe('top');
  });

  it('falls back to above in a cramped container where neither side fits', () => {
    const placement = getMapPinHovercardPlacement({
      pinHeadTopPx: 40,
      pinTipPx: 72,
      cardHeightPx: 140,
      mapHeightPx: 120,
    });

    expect(placement).toBe('top');
  });

  it('respects caller-supplied gap and buffer', () => {
    // A 32-px gap makes the card no longer fit above (it does with default 8).
    const placement = getMapPinHovercardPlacement({
      pinHeadTopPx: 160,
      pinTipPx: 192,
      cardHeightPx: 140,
      mapHeightPx: 600,
      gapPx: 32,
      bufferPx: 0,
    });

    expect(placement).toBe('bottom');
  });
});
