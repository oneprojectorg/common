import { describe, expect, it } from 'vitest';

import type { RubricTemplateSchema } from '../types';
import { getPhaseRubricTemplate } from './phaseTemplates';

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
