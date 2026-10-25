import { describe, expect, it } from 'vitest';

import { getUpdatedInstanceData } from './getUpdatedInstanceData';
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
  it('is undefined when the update carries nothing for instanceData', () => {
    expect(getUpdatedInstanceData({ existing: existing(), update: {} })).toBe(
      undefined,
    );
    expect(
      getUpdatedInstanceData({ existing: existing(), update: { phases: [] } }),
    ).toBe(undefined);
  });

  it('does not mutate the stored data', () => {
    const stored = existing();
    const snapshot = structuredClone(stored);

    getUpdatedInstanceData({
      existing: stored,
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
      update: {
        config: {
          categories: [
            { id: 'a', label: '  Parks ', description: ' Green space ' },
          ],
        },
      },
    });

    expect(result?.instanceData.config).toEqual({
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
      update: { config: { hideBudget: true } },
    });

    expect(result?.instanceData.config).toEqual({
      hideBudget: true,
      categories: [{ id: 'a', label: 'Parks', description: '' }],
    });
  });

  it('merges the overview and keeps a headline it is not asked to change', () => {
    const result = getUpdatedInstanceData({
      existing: existing(),
      update: { overview: { description: 'New blurb' } },
    });

    expect(result?.instanceData.overview).toEqual({
      headline: 'Old headline',
      description: 'New blurb',
    });
  });

  it('clears the headline on null, and drops a legacy blank one', () => {
    expect(
      getUpdatedInstanceData({
        existing: existing(),
        update: { overview: { headline: null } },
      })?.instanceData.overview,
    ).toEqual({ description: 'Old blurb' });

    const blank = existing();
    blank.overview = { headline: '  ', description: 'Old blurb' };

    expect(
      getUpdatedInstanceData({
        existing: blank,
        update: { overview: { description: 'New blurb' } },
      })?.instanceData.overview,
    ).toEqual({ description: 'New blurb' });
  });

  it('replaces the phase list and keeps stored data on phases that remain', () => {
    const result = getUpdatedInstanceData({
      existing: existing(),
      update: {
        phases: [
          { phaseId: 'voting', name: 'Final vote', endDate: '2026-03-31' },
          { phaseId: 'results', name: 'Results' },
        ],
      },
    });

    expect(result?.instanceData.phases).toEqual([
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
      update: {
        phases: [{ phaseId: 'voting', rubricTemplate: null, headline: null }],
      },
    });

    expect(result?.instanceData.phases[0]).toEqual({
      phaseId: 'voting',
      name: 'Voting',
      endDate: '2026-02-28',
      rules: { voting: { submit: true } },
    });
  });

  it('reports only end dates that really changed', () => {
    const result = getUpdatedInstanceData({
      existing: existing(),
      update: {
        phases: [
          { phaseId: 'submission', endDate: '2026-01-31' },
          { phaseId: 'voting', endDate: '2026-03-31' },
          { phaseId: 'results', endDate: '2026-04-30' },
        ],
      },
    });

    expect(result?.phaseEndDateChanges).toEqual([
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
      update: { proposalTemplate, rubricTemplate },
    });

    expect(result?.instanceData.proposalTemplate).toBe(proposalTemplate);
    expect(result?.instanceData.rubricTemplate).toBe(rubricTemplate);
    expect(result?.phaseEndDateChanges).toEqual([]);
  });
});
