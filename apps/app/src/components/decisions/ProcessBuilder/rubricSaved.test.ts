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
    expect(hasRubricChange({ instanceId, name: 'Budget 2026' })).toBe(false);
  });

  it('is false when the rubric key is present but undefined', () => {
    // "Update Process" spreads every key, so presence alone is not the gate.
    expect(
      hasRubricChange({
        instanceId,
        name: 'Budget 2026',
        rubricTemplate: undefined,
      }),
    ).toBe(false);
  });

  it('is true for a rubric cleared back to an empty template', () => {
    expect(
      hasRubricChange({ instanceId, rubricTemplate: { type: 'object' } }),
    ).toBe(true);
  });
});
