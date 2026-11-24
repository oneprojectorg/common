import { describe, expect, it } from 'vitest';

import type { ProposalTemplateSchema, RubricTemplateSchema } from '../types';
import {
  getPhaseProposalTemplate,
  getPhaseRubricTemplate,
  isPhaseReady,
} from './phaseTemplates';

const instanceRubric: RubricTemplateSchema = {
  type: 'object',
  properties: { impact: { type: 'integer' } },
};

const phaseRubric: RubricTemplateSchema = {
  type: 'object',
  properties: { viability: { type: 'integer' } },
};

describe('getPhaseRubricTemplate', () => {
  it('returns the phase rubric when the phase has its own', () => {
    const instanceData = {
      rubricTemplate: instanceRubric,
      phases: [
        { phaseId: 'feasibility', rubricTemplate: phaseRubric },
        { phaseId: 'community' },
      ],
    };

    expect(getPhaseRubricTemplate(instanceData, 'feasibility')).toBe(
      phaseRubric,
    );
  });

  it('falls back to the instance rubric when the phase has none', () => {
    const instanceData = {
      rubricTemplate: instanceRubric,
      phases: [
        { phaseId: 'feasibility', rubricTemplate: phaseRubric },
        { phaseId: 'community' },
      ],
    };

    expect(getPhaseRubricTemplate(instanceData, 'community')).toBe(
      instanceRubric,
    );
  });

  it('falls back to the instance rubric for an unknown phase', () => {
    const instanceData = {
      rubricTemplate: instanceRubric,
      phases: [{ phaseId: 'review', rubricTemplate: phaseRubric }],
    };

    expect(getPhaseRubricTemplate(instanceData, 'nope')).toBe(instanceRubric);
  });

  it('falls back to the instance rubric when no phase is named (cross-phase reads)', () => {
    const instanceData = {
      rubricTemplate: instanceRubric,
      phases: [{ phaseId: 'review', rubricTemplate: phaseRubric }],
    };

    expect(getPhaseRubricTemplate(instanceData, undefined)).toBe(
      instanceRubric,
    );
  });

  it('returns null when neither the phase nor the instance has a rubric', () => {
    expect(
      getPhaseRubricTemplate({ phases: [{ phaseId: 'review' }] }, 'review'),
    ).toBeNull();
    expect(getPhaseRubricTemplate({}, 'review')).toBeNull();
    expect(getPhaseRubricTemplate({}, undefined)).toBeNull();
  });

  it('prefers the phase rubric even when the instance also has one set', () => {
    const instanceData = {
      rubricTemplate: instanceRubric,
      phases: [{ phaseId: 'review', rubricTemplate: phaseRubric }],
    };

    expect(getPhaseRubricTemplate(instanceData, 'review')).toBe(phaseRubric);
  });

  it('returns the phase rubric when the instance has none', () => {
    const instanceData = {
      phases: [{ phaseId: 'review', rubricTemplate: phaseRubric }],
    };

    expect(getPhaseRubricTemplate(instanceData, 'review')).toBe(phaseRubric);
  });
});

describe('getPhaseProposalTemplate', () => {
  const instanceForm: ProposalTemplateSchema = {
    type: 'object',
    properties: { title: { type: 'string' } },
  };
  const phaseForm: ProposalTemplateSchema = {
    type: 'object',
    properties: { budget: { type: 'number' } },
  };
  const instanceData = {
    proposalTemplate: instanceForm,
    rubricTemplate: instanceRubric,
    phases: [
      { phaseId: 'develop', proposalTemplate: phaseForm },
      { phaseId: 'review', rubricTemplate: phaseRubric },
    ],
  };

  it("returns the phase's own form", () => {
    expect(getPhaseProposalTemplate(instanceData, 'develop')).toBe(phaseForm);
  });

  it('falls back to the instance form, ignoring a phase rubric', () => {
    expect(getPhaseProposalTemplate(instanceData, 'review')).toBe(instanceForm);
  });
});

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

  it('counts only questions the admin wrote, not the system fields', () => {
    const collecting = { ...dated, rules: { proposals: { submit: true } } };

    expect(
      isPhaseReady(collecting, {
        proposalTemplate: {
          properties: { title: {}, budget: {}, category: {} },
        },
      }),
    ).toBe(false);
    expect(
      isPhaseReady(collecting, {
        proposalTemplate: { properties: { title: {}, summary: {} } },
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
