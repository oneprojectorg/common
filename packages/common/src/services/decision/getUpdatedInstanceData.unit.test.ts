import { describe, expect, it } from 'vitest';

import {
  getUpdatedInstanceData,
  hasNonPhaseUpdate,
  hasPhaseUpdates,
} from './getUpdatedInstanceData';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { RubricTemplateSchema } from './types';

const existing = (): DecisionInstanceData => ({
  config: { hideBudget: false, categories: [] },
  overview: { headline: 'Old headline', description: 'Old blurb' },
  phases: [
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
  ],
  proposalTemplate: {
    type: 'object',
    properties: { title: { type: 'string' } },
  },
});

describe('getUpdatedInstanceData', () => {
  it('sets nothing when the update carries nothing for instanceData', () => {
    expect(
      getUpdatedInstanceData({
        existing: existing(),
        existingPhases: existing().phases,
        update: {},
      }),
    ).toEqual({ phaseEndDateChanges: [] });
    expect(
      getUpdatedInstanceData({
        existing: existing(),
        existingPhases: existing().phases,
        update: { phases: [] },
      }),
    ).toEqual({ phaseEndDateChanges: [] });
  });

  it('does not mutate the stored data', () => {
    const stored = existing();
    const snapshot = structuredClone(stored);

    getUpdatedInstanceData({
      existing: stored,
      existingPhases: stored.phases,
      update: {
        config: { hideBudget: true },
        overview: { headline: null },
        phases: [{ phaseId: 'voting', endDate: '2026-03-31' }],
      },
    });

    expect(stored).toEqual(snapshot);
  });

  it('merges config and trims category copy', () => {
    const result = getUpdatedInstanceData({
      existing: existing(),
      existingPhases: existing().phases,
      update: {
        config: {
          categories: [
            { id: 'a', label: '  Parks ', description: ' Green space ' },
          ],
        },
      },
    });

    expect(result.instanceData?.config).toEqual({
      hideBudget: false,
      categories: [{ id: 'a', label: 'Parks', description: 'Green space' }],
    });
  });

  it('keeps stored categories when the config update omits them', () => {
    const stored = existing();
    stored.config = {
      categories: [{ id: 'a', label: 'Parks', description: '' }],
    };

    const result = getUpdatedInstanceData({
      existing: stored,
      existingPhases: stored.phases,
      update: { config: { hideBudget: true } },
    });

    expect(result.instanceData?.config).toEqual({
      hideBudget: true,
      categories: [{ id: 'a', label: 'Parks', description: '' }],
    });
  });

  it('merges the overview and keeps a headline it is not asked to change', () => {
    const result = getUpdatedInstanceData({
      existing: existing(),
      existingPhases: existing().phases,
      update: { overview: { description: 'New blurb' } },
    });

    expect(result.instanceData?.overview).toEqual({
      headline: 'Old headline',
      description: 'New blurb',
    });
  });

  it('clears the headline on null, and drops a legacy blank one', () => {
    expect(
      getUpdatedInstanceData({
        existing: existing(),
        existingPhases: existing().phases,
        update: { overview: { headline: null } },
      }).instanceData?.overview,
    ).toEqual({ description: 'Old blurb' });

    const blank = existing();
    blank.overview = { headline: '  ', description: 'Old blurb' };

    expect(
      getUpdatedInstanceData({
        existing: blank,
        existingPhases: blank.phases,
        update: { overview: { description: 'New blurb' } },
      }).instanceData?.overview,
    ).toEqual({ description: 'New blurb' });
  });

  it('replaces the phase list and keeps stored data on phases that remain', () => {
    const result = getUpdatedInstanceData({
      existing: existing(),
      existingPhases: existing().phases,
      update: {
        phases: [
          { phaseId: 'voting', name: 'Final vote', endDate: '2026-03-31' },
          { phaseId: 'results', name: 'Results' },
        ],
      },
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
  });

  it('clears a phase rubric and headline on null', () => {
    const stored = existing();
    stored.phases[1] = { ...stored.phases[1]!, headline: 'Vote now' };

    const result = getUpdatedInstanceData({
      existing: stored,
      existingPhases: stored.phases,
      update: {
        phases: [{ phaseId: 'voting', rubricTemplate: null, headline: null }],
      },
    });

    expect(result.phases?.[0]).toEqual({
      phaseId: 'voting',
      name: 'Voting',
      endDate: '2026-02-28',
      rules: { voting: { submit: true } },
    });
  });

  it('merges phases onto existingPhases and keeps the stored ones in instanceData', () => {
    const stored = existing();
    const rowPhases = [{ phaseId: 'review', name: 'Review' }];

    const result = getUpdatedInstanceData({
      existing: stored,
      existingPhases: rowPhases,
      update: {
        overview: { description: 'New blurb' },
        phases: [{ phaseId: 'review', endDate: '2026-05-31' }],
      },
    });

    expect(result.phases).toEqual([
      { phaseId: 'review', name: 'Review', endDate: '2026-05-31' },
    ]);
    expect(result.instanceData?.phases).toEqual(stored.phases);
  });

  it('reports only end dates that really changed', () => {
    const result = getUpdatedInstanceData({
      existing: existing(),
      existingPhases: existing().phases,
      update: {
        phases: [
          { phaseId: 'submission', endDate: '2026-01-31' },
          { phaseId: 'voting', endDate: '2026-03-31' },
          { phaseId: 'results', endDate: '2026-04-30' },
        ],
      },
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

    const result = getUpdatedInstanceData({
      existing: existing(),
      existingPhases: existing().phases,
      update: { proposalTemplate, rubricTemplate },
    });

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
