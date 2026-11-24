import { describe, expect, it } from 'vitest';

import { getSetupBlurbKey, isPhaseReady } from './phaseSetup';

const dated = {
  id: 'row-1',
  slug: 'a1b2c3d4',
  phaseId: 'phase-1',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-01-31T00:00:00.000Z',
};
const form = { type: 'object' as const, properties: { title: {} } };

describe('isPhaseReady', () => {
  it('needs both dates', () => {
    expect(isPhaseReady({ ...dated, endDate: undefined }, {})).toBe(false);
    expect(isPhaseReady({ ...dated, startDate: undefined }, {})).toBe(false);
    expect(isPhaseReady(dated, {})).toBe(true);
  });

  it("takes a collecting phase's own form first, then the decision's", () => {
    const collecting = { ...dated, rules: { proposals: { submit: true } } };

    expect(isPhaseReady(collecting, {})).toBe(false);
    expect(isPhaseReady(collecting, { proposalTemplate: form })).toBe(true);
    expect(isPhaseReady({ ...collecting, proposalTemplate: form }, {})).toBe(
      true,
    );
    expect(
      isPhaseReady(
        {
          ...collecting,
          proposalTemplate: { type: 'object', properties: {} },
        },
        { proposalTemplate: form },
      ),
    ).toBe(false);
  });

  it('needs a field in the form, not just a form', () => {
    expect(
      isPhaseReady(
        { ...dated, rules: { proposals: { develop: true } } },
        { proposalTemplate: { type: 'object', properties: {} } },
      ),
    ).toBe(false);
  });

  it('needs a criterion on a review phase', () => {
    const reviewing = { ...dated, rules: { reviews: { submit: true } } };

    expect(isPhaseReady(reviewing, { proposalTemplate: form })).toBe(false);
    expect(isPhaseReady(reviewing, { rubricTemplate: form })).toBe(true);
  });

  it('needs both forms on a phase that collects proposals and reviews them', () => {
    const both = {
      ...dated,
      rules: { proposals: { submit: true }, reviews: { submit: true } },
    };

    expect(isPhaseReady(both, { rubricTemplate: form })).toBe(false);
    expect(isPhaseReady(both, { proposalTemplate: form })).toBe(false);
    expect(
      isPhaseReady(both, { proposalTemplate: form, rubricTemplate: form }),
    ).toBe(true);
  });

  it('needs no form on a voting phase', () => {
    expect(
      isPhaseReady({ ...dated, rules: { voting: { submit: true } } }, {}),
    ).toBe(true);
  });
});

describe('getSetupBlurbKey', () => {
  it.each([
    [
      { reviews: { submit: true }, proposals: { submit: true } },
      'setupBlurbReview',
    ],
    [{ proposals: { submit: true } }, 'setupBlurbCollect'],
    [{ proposals: { develop: true } }, 'setupBlurbDevelop'],
    [{ voting: { submit: true } }, 'setupBlurbVote'],
    [{}, 'setupBlurbResults'],
  ])('picks the blurb from the capabilities %j', (rules, key) => {
    expect(getSetupBlurbKey({ ...dated, rules })).toBe(key);
  });
});
