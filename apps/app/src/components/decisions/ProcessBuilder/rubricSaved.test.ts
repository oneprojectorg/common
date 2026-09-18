import { describe, expect, it } from 'vitest';

import { hasRubricChange } from './rubricSaved';

const instanceId = '11111111-1111-4111-8111-111111111111';

describe('hasRubricChange', () => {
  it('is true when the write carries a rubric', () => {
    expect(
      hasRubricChange({
        instanceId,
        rubricTemplate: { type: 'object', properties: {} },
      }),
    ).toBe(true);
  });

  it('is false when the rubric key is absent', () => {
    // The draft autosave sends only the fields edited since the last debounce.
    expect(hasRubricChange({ instanceId, name: 'Budget 2026' })).toBe(false);
  });

  it('is false when the rubric key is present but undefined', () => {
    // "Update Process" always spreads every key and leaves the value undefined
    // for anything the admin did not touch, so presence alone is not the gate.
    expect(
      hasRubricChange({
        instanceId,
        name: 'Budget 2026',
        rubricTemplate: undefined,
      }),
    ).toBe(false);
  });

  it('is true for a rubric cleared back to an empty template', () => {
    // Emptying the rubric is still the admin setting it — the server counts
    // this write too, so the browser copy must not treat it as a no-op.
    expect(
      hasRubricChange({ instanceId, rubricTemplate: { type: 'object' } }),
    ).toBe(true);
  });
});
