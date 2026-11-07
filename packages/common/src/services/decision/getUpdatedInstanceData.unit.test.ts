import { describe, expect, it } from 'vitest';

import {
  type InstanceDataUpdate,
  getUpdatedInstanceData,
  hasNonPhaseUpdate,
  hasPhaseUpdates,
} from './getUpdatedInstanceData';
import type {
  DecisionInstanceData,
  PhaseInstanceData,
} from './schemas/instanceData';
import type { RubricTemplateSchema } from './types';

const existing = (): DecisionInstanceData => ({
  config: { hideBudget: false, categories: [] },
  overview: { headline: 'Old headline', description: 'Old blurb' },
  proposalTemplate: {
    type: 'object',
    properties: { title: { type: 'string' } },
  },
});

const existingPhases = (): PhaseInstanceData[] => [
  {
    phaseId: 'submission',
    name: 'Submission',
    endDate: '2026-01-31',
    rules: { proposals: { submit: true } },
    settingsSchema: { type: 'object' },
  },
  {
    phaseId: 'voting',
    name: 'Voting',
    endDate: '2026-02-28',
    rules: { voting: { submit: true } },
    rubricTemplate: { type: 'object', properties: {} },
  },
];

const apply = (
  update: InstanceDataUpdate,
  stored: {
    instanceData?: DecisionInstanceData;
    phases?: PhaseInstanceData[];
  } = {},
) =>
  getUpdatedInstanceData({
    existing: stored.instanceData ?? existing(),
    existingPhases: stored.phases ?? existingPhases(),
    update,
  });

describe('getUpdatedInstanceData', () => {
  it('sets nothing when the update carries nothing for instanceData', () => {
    expect(apply({})).toEqual({ phaseEndDateChanges: [] });
    expect(apply({ phases: [] })).toEqual({ phaseEndDateChanges: [] });
  });

  it('does not mutate the stored data', () => {
    const instanceData = existing();
    const phases = existingPhases();
    const snapshot = structuredClone({ instanceData, phases });

    apply(
      {
        config: { hideBudget: true },
        overview: { headline: null },
        phases: [{ phaseId: 'voting', endDate: '2026-03-31' }],
      },
      { instanceData, phases },
    );

    expect({ instanceData, phases }).toEqual(snapshot);
  });

  it('merges config and trims category copy', () => {
    const result = apply({
      config: {
        categories: [
          { id: 'a', label: '  Parks ', description: ' Green space ' },
        ],
      },
    });

    expect(result.instanceData?.config).toEqual({
      hideBudget: false,
      categories: [{ id: 'a', label: 'Parks', description: 'Green space' }],
    });
  });

  it('keeps stored categories when the config update omits them', () => {
    const result = apply(
      { config: { hideBudget: true } },
      {
        instanceData: {
          ...existing(),
          config: {
            categories: [{ id: 'a', label: 'Parks', description: '' }],
          },
        },
      },
    );

    expect(result.instanceData?.config).toEqual({
      hideBudget: true,
      categories: [{ id: 'a', label: 'Parks', description: '' }],
    });
  });

  it('merges the overview and keeps a headline it is not asked to change', () => {
    const result = apply({ overview: { description: 'New blurb' } });

    expect(result.instanceData?.overview).toEqual({
      headline: 'Old headline',
      description: 'New blurb',
    });
  });

  it('clears the headline on null, and drops a legacy blank one', () => {
    expect(
      apply({ overview: { headline: null } }).instanceData?.overview,
    ).toEqual({ description: 'Old blurb' });

    expect(
      apply(
        { overview: { description: 'New blurb' } },
        {
          instanceData: {
            ...existing(),
            overview: { headline: '  ', description: 'Old blurb' },
          },
        },
      ).instanceData?.overview,
    ).toEqual({ description: 'New blurb' });
  });

  it('sets no phases when the update carries none', () => {
    const result = apply({ config: { hideBudget: true } });

    expect(result.phases).toBeUndefined();
    expect(result.instanceData).not.toHaveProperty('phases');
  });

  it('replaces the phase list and keeps stored data on phases that remain', () => {
    const result = apply({
      phases: [
        { phaseId: 'voting', name: 'Final vote', endDate: '2026-03-31' },
        { phaseId: 'results', name: 'Results' },
      ],
    });

    expect(result.phases).toEqual([
      {
        phaseId: 'voting',
        name: 'Final vote',
        endDate: '2026-03-31',
        rules: { voting: { submit: true } },
        rubricTemplate: { type: 'object', properties: {} },
      },
      { phaseId: 'results', name: 'Results' },
    ]);
    expect(result.instanceData).toBeUndefined();
  });

  it('clears a phase rubric and headline on null', () => {
    const result = apply(
      {
        phases: [{ phaseId: 'voting', rubricTemplate: null, headline: null }],
      },
      {
        phases: existingPhases().map((phase) =>
          phase.phaseId === 'voting'
            ? { ...phase, headline: 'Vote now' }
            : phase,
        ),
      },
    );

    expect(result.phases?.[0]).toEqual({
      phaseId: 'voting',
      name: 'Voting',
      endDate: '2026-02-28',
      rules: { voting: { submit: true } },
    });
  });

  it('merges phases onto existingPhases alongside an instanceData update', () => {
    const result = apply(
      {
        overview: { description: 'New blurb' },
        phases: [{ phaseId: 'review', endDate: '2026-05-31' }],
      },
      { phases: [{ phaseId: 'review', name: 'Review' }] },
    );

    expect(result.phases).toEqual([
      { phaseId: 'review', name: 'Review', endDate: '2026-05-31' },
    ]);
    expect(result.instanceData).not.toHaveProperty('phases');
  });

  it('reports only end dates that really changed', () => {
    const result = apply({
      phases: [
        { phaseId: 'submission', endDate: '2026-01-31' },
        { phaseId: 'voting', endDate: '2026-03-31' },
        { phaseId: 'results', endDate: '2026-04-30' },
      ],
    });

    expect(result.phaseEndDateChanges).toEqual([
      {
        phaseId: 'voting',
        previousEndDate: '2026-02-28',
        newEndDate: '2026-03-31',
      },
    ]);
  });

  it('replaces the templates wholesale', () => {
    const proposalTemplate = { type: 'object', properties: {} };
    const rubricTemplate: RubricTemplateSchema = {
      type: 'object',
      properties: { score: { type: 'number' } },
    };

    const result = apply({ proposalTemplate, rubricTemplate });

    expect(result.instanceData?.proposalTemplate).toBe(proposalTemplate);
    expect(result.instanceData?.rubricTemplate).toBe(rubricTemplate);
    expect(result.phaseEndDateChanges).toEqual([]);
  });
});

describe('hasNonPhaseUpdate', () => {
  it('is true for any field but phases', () => {
    expect(hasNonPhaseUpdate({ config: {} })).toBe(true);
    expect(hasNonPhaseUpdate({ overview: {} })).toBe(true);
    expect(hasNonPhaseUpdate({ proposalTemplate: {} })).toBe(true);
    expect(
      hasNonPhaseUpdate({ rubricTemplate: { type: 'object', properties: {} } }),
    ).toBe(true);
    expect(hasNonPhaseUpdate({ phases: [{ phaseId: 'voting' }] })).toBe(false);
    expect(hasNonPhaseUpdate({})).toBe(false);
  });
});

describe('hasPhaseUpdates', () => {
  it('is true only when the update lists a phase', () => {
    expect(hasPhaseUpdates({ phases: [{ phaseId: 'voting' }] })).toBe(true);
    expect(hasPhaseUpdates({ phases: [] })).toBe(false);
    expect(hasPhaseUpdates({ config: {} })).toBe(false);
  });
});
