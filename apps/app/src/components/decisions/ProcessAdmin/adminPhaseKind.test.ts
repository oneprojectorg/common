import { describe, expect, it } from 'vitest';

import { getAdminPhaseKind } from './adminPhaseKind';

const phase = { id: 'row-1', slug: 'a1b2c3d4', phaseId: 'phase-1' };

describe('getAdminPhaseKind', () => {
  it.each([
    [{ reviews: { submit: true } }, 'Review'],
    [{ proposals: { review: true } }, 'Review'],
    [{ reviews: { submit: true }, proposals: { submit: true } }, 'Review'],
    [{ proposals: { submit: true } }, 'Collect'],
    [{ proposals: { develop: true } }, 'Develop'],
    [{ voting: { submit: true } }, 'Vote'],
    [{}, 'Results'],
  ])('reads the kind from the capabilities %j', (rules, kind) => {
    expect(getAdminPhaseKind({ ...phase, rules })).toBe(kind);
  });
});
