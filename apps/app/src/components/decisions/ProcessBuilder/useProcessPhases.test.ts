import { describe, expect, it } from 'vitest';

import { resolveProcessPhases } from './useProcessPhases';

const templatePhases = [{ id: 'submission', name: 'Submit' }];

describe('resolveProcessPhases', () => {
  it("shows a blank process's empty list, not its template's phases", () => {
    expect(
      resolveProcessPhases({ instancePhases: [], templatePhases }),
    ).toEqual([]);
  });

  it('falls back to the template for an instance with no phase list', () => {
    expect(resolveProcessPhases({ templatePhases })).toEqual([
      { phaseId: 'submission', name: 'Submit' },
    ]);
  });

  it("prefers the instance's own phases", () => {
    expect(
      resolveProcessPhases({
        instancePhases: [{ phaseId: 'ideas', name: 'Ideas' }],
        templatePhases,
      }),
    ).toEqual([{ phaseId: 'ideas', name: 'Ideas' }]);
  });

  it('prefers unsaved phases in the editor over saved ones', () => {
    expect(
      resolveProcessPhases({
        storePhases: [{ phaseId: 'draft', name: 'Draft' }],
        instancePhases: [{ phaseId: 'ideas', name: 'Ideas' }],
      }),
    ).toEqual([{ phaseId: 'draft', name: 'Draft' }]);
  });
});
