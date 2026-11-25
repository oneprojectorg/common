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
    expect(
      isPhaseReady({ phase: { ...dated, endDate: undefined }, decision: {} }),
    ).toBe(false);
    expect(
      isPhaseReady({ phase: { ...dated, startDate: null }, decision: {} }),
    ).toBe(false);
    expect(isPhaseReady({ phase: dated, decision: {} })).toBe(true);
  });

  it("takes a collecting phase's own form first, then the decision's", () => {
    const collecting = { ...dated, rules: { proposals: { submit: true } } };

    expect(isPhaseReady({ phase: collecting, decision: {} })).toBe(false);
    expect(
      isPhaseReady({ phase: collecting, decision: { proposalTemplate: form } }),
    ).toBe(true);
    expect(
      isPhaseReady({
        phase: { ...collecting, proposalTemplate: form },
        decision: {},
      }),
    ).toBe(true);
    expect(
      isPhaseReady({
        phase: { ...collecting, proposalTemplate: emptyForm },
        decision: { proposalTemplate: form },
      }),
    ).toBe(false);
  });

  it('needs a field in the form, not just a form', () => {
    const developing = { ...dated, rules: { proposals: { develop: true } } };

    expect(
      isPhaseReady({
        phase: developing,
        decision: { proposalTemplate: emptyForm },
      }),
    ).toBe(false);
    expect(
      isPhaseReady({ phase: developing, decision: { proposalTemplate: form } }),
    ).toBe(true);
  });

  it('does not count the title as a question', () => {
    const collecting = { ...dated, rules: { proposals: { submit: true } } };

    expect(
      isPhaseReady({
        phase: collecting,
        decision: { proposalTemplate: { properties: { title: {} } } },
      }),
    ).toBe(false);
    expect(
      isPhaseReady({
        phase: collecting,
        decision: {
          proposalTemplate: { properties: { title: {}, budget: {} } },
        },
      }),
    ).toBe(true);
  });

  it('needs a criterion on a review phase', () => {
    const reviewing = { ...dated, rules: { reviews: { submit: true } } };

    expect(
      isPhaseReady({ phase: reviewing, decision: { proposalTemplate: form } }),
    ).toBe(false);
    expect(
      isPhaseReady({
        phase: reviewing,
        decision: { rubricTemplate: emptyForm },
      }),
    ).toBe(false);
    expect(
      isPhaseReady({ phase: reviewing, decision: { rubricTemplate: form } }),
    ).toBe(true);
  });

  it("takes a review phase's own rubric over the decision's", () => {
    const reviewing = { ...dated, rules: { reviews: { submit: true } } };

    expect(
      isPhaseReady({
        phase: { ...reviewing, rubricTemplate: emptyForm },
        decision: { rubricTemplate: form },
      }),
    ).toBe(false);
    expect(
      isPhaseReady({
        phase: { ...reviewing, rubricTemplate: form },
        decision: {},
      }),
    ).toBe(true);
  });

  it('needs both forms on a phase that collects proposals and reviews them', () => {
    const both = {
      ...dated,
      rules: { proposals: { submit: true }, reviews: { submit: true } },
    };

    expect(
      isPhaseReady({ phase: both, decision: { rubricTemplate: form } }),
    ).toBe(false);
    expect(
      isPhaseReady({ phase: both, decision: { proposalTemplate: form } }),
    ).toBe(false);
    expect(
      isPhaseReady({
        phase: both,
        decision: { proposalTemplate: form, rubricTemplate: form },
      }),
    ).toBe(true);
  });

  it('needs no form on a voting phase', () => {
    expect(
      isPhaseReady({
        phase: { ...dated, rules: { voting: { submit: true } } },
        decision: {},
      }),
    ).toBe(true);
  });
});
