import { describe, expect, it } from 'vitest';

import { isPhaseReady } from './phaseReadiness';

describe('isPhaseReady', () => {
  const dated = {
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-01-31T00:00:00.000Z',
  };
  const form = { properties: { summary: {} } };
  const emptyForm = { properties: {} };

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
        { ...collecting, proposalTemplate: emptyForm },
        { proposalTemplate: form },
      ),
    ).toBe(false);
  });

  it('needs a field in the form, not just a form', () => {
    expect(
      isPhaseReady(
        { ...dated, rules: { proposals: { develop: true } } },
        { proposalTemplate: emptyForm },
      ),
    ).toBe(false);
  });

  it('does not count the title as a question', () => {
    const collecting = { ...dated, rules: { proposals: { submit: true } } };

    expect(
      isPhaseReady(collecting, {
        proposalTemplate: { properties: { title: {} } },
      }),
    ).toBe(false);
    expect(
      isPhaseReady(collecting, {
        proposalTemplate: { properties: { title: {}, budget: {} } },
      }),
    ).toBe(true);
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
