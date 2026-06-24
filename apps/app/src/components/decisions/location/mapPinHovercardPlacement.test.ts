/**
 * Tests for the pure placement helper that decides whether a map pin's
 * hovercard renders above (default) or flipped below the pin.
 *
 * The decision is made on the cheap and on the hot path of every hover open
 * — without a measurement round-trip — so the helper is just arithmetic over
 * the pin/card/container heights. These tests pin the edge cases (just-fits,
 * just-overflows, cramped container).
 */
import { getMapPinHovercardPlacement } from '@op/ui/MapMarker';
import { describe, expect, it } from 'vitest';

describe('getMapPinHovercardPlacement', () => {
  // Tall enough container, pin near the bottom — plenty of room above. The
  // hovercard's design default is to sit above the pin, so this should not
  // flip.
  it('renders above when the card fits above the pin head', () => {
    const placement = getMapPinHovercardPlacement({
      // Pin head sits 200px down; 200px of room above the head.
      pinHeadTopPx: 200,
      pinTipPx: 232,
      cardHeightPx: 140,
      mapHeightPx: 600,
    });

    expect(placement).toBe('top');
  });

  // Pin is right at the top of the map — no room for the card above. There
  // is plenty of room below, so we flip the card under the pin.
  it('flips below when the pin is near the top edge', () => {
    const placement = getMapPinHovercardPlacement({
      pinHeadTopPx: 4,
      pinTipPx: 36,
      cardHeightPx: 140,
      mapHeightPx: 600,
    });

    expect(placement).toBe('bottom');
  });

  // The card just barely fits above, including the 8px gap + 8px edge
  // buffer. We expect "top" (the default) — no spurious flip.
  it("keeps the card above when it just barely fits — doesn't flip on a tie", () => {
    // pinHeadTopPx - gap(8) - card(140) === buffer(8) -> exactly fits.
    const placement = getMapPinHovercardPlacement({
      pinHeadTopPx: 156,
      pinTipPx: 188,
      cardHeightPx: 140,
      mapHeightPx: 600,
    });

    expect(placement).toBe('top');
  });

  // Neither above nor below has room (tiny container). The helper falls back
  // to "top" — overflowing the top is preferable to obscuring the pin itself,
  // which is the design default.
  it('falls back to above in a cramped container where neither fits', () => {
    const placement = getMapPinHovercardPlacement({
      pinHeadTopPx: 40,
      pinTipPx: 72,
      cardHeightPx: 140,
      mapHeightPx: 120,
    });

    expect(placement).toBe('top');
  });

  // Caller-supplied gap and buffer override the defaults — used when the
  // container has different padding than the default 8px breathing room.
  it('respects caller-supplied gap and buffer', () => {
    // With a 32-px gap, the card no longer fits above even though it would
    // with the default 8-px gap.
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
