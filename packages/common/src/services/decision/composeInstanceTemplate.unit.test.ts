import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../utils';
import {
  blankInstanceData,
  composeInstanceTemplate,
} from './composeInstanceTemplate';
import type { CreateInstanceInput } from './schemas/createInstance';
import { createInstanceDataFromTemplate } from './schemas/instanceData';
import { isReviewPhase } from './utils/phaseSettings';

const pbIdeas: CreateInstanceInput = {
  name: 'Neighbourhood fund',
  type: 'pb',
  phases: [
    { kind: 'submissions', name: 'Share your ideas' },
    { kind: 'review', name: 'Review ideas' },
    { kind: 'submissions', name: 'Build proposals' },
    { kind: 'voting', name: 'Vote' },
    { kind: 'results', name: 'See results' },
  ],
};

describe('composeInstanceTemplate', () => {
  it('names and ids the template by the answers, not the process', () => {
    const template = composeInstanceTemplate(pbIdeas);

    expect(template.id).toBe('composed:pb');
    expect(template.name).toBe('Participatory budgeting');
    expect(template.proposalTemplate).toBeUndefined();
  });

  it('keeps the phases in order with the names the creator saw', () => {
    const template = composeInstanceTemplate(pbIdeas);

    expect(template.phases.map((phase) => phase.name)).toEqual(
      pbIdeas.phases.map((phase) => phase.name),
    );
  });

  it('gives a repeated kind a distinct id', () => {
    const template = composeInstanceTemplate(pbIdeas);

    expect(template.phases.map((phase) => phase.id)).toEqual([
      'submissions',
      'review',
      'submissions-2',
      'voting',
      'results',
    ]);
  });

  it('counts on past the second repeat of a kind', () => {
    const template = composeInstanceTemplate({
      ...pbIdeas,
      phases: [
        { kind: 'submissions', name: 'Ideas' },
        { kind: 'submissions', name: 'Drafts' },
        { kind: 'submissions', name: 'Proposals' },
      ],
    });

    expect(template.phases.map((phase) => phase.id)).toEqual([
      'submissions',
      'submissions-2',
      'submissions-3',
    ]);
  });

  it('labels the template with the process type', () => {
    expect(composeInstanceTemplate({ ...pbIdeas, type: 'grant' }).name).toBe(
      'Grant',
    );
    expect(composeInstanceTemplate({ ...pbIdeas, type: 'other' }).name).toBe(
      'Custom',
    );
  });

  it('lets each kind do only its own thing', () => {
    const [intake, review, develop, vote, results] =
      composeInstanceTemplate(pbIdeas).phases;

    expect(intake?.rules.proposals).toEqual({ submit: true, edit: true });
    expect(isReviewPhase(review ?? {})).toBe(true);
    expect(review?.rules.proposals?.submit).toBe(false);
    expect(develop?.rules.proposals?.submit).toBe(true);
    expect(vote?.rules.voting?.submit).toBe(true);
    expect(vote?.rules.proposals?.submit).toBe(false);
    expect(results?.rules.voting?.submit).toBe(false);
    expect(results?.rules.proposals?.submit).toBe(false);
  });

  it('advances by hand everywhere, so a draft needs no dates', () => {
    for (const phase of composeInstanceTemplate(pbIdeas).phases) {
      expect(phase.rules.advancement).toEqual({ method: 'manual' });
    }
  });

  it('passes every submission on and leaves later selections to an admin', () => {
    const [intake, review, develop, vote, results] =
      composeInstanceTemplate(pbIdeas).phases;

    expect(intake?.selectionPipeline).toEqual({ version: '1.0.0', blocks: [] });
    expect(develop?.selectionPipeline).toEqual({
      version: '1.0.0',
      blocks: [],
    });
    expect(review?.selectionPipeline).toBeUndefined();
    expect(vote?.selectionPipeline).toBeUndefined();
    expect(results?.selectionPipeline).toBeUndefined();
  });

  it('adds no settings forms of its own', () => {
    for (const phase of composeInstanceTemplate(pbIdeas).phases) {
      expect(phase.settings).toBeUndefined();
    }
  });

  it('gives a single-phase process no pipeline, since it is also the last', () => {
    const [only] = composeInstanceTemplate({
      ...pbIdeas,
      phases: [{ kind: 'submissions', name: 'Ideas' }],
    }).phases;

    expect(only.selectionPipeline).toBeUndefined();
  });

  it('hides budgets only for a process that is neither grants nor PB', () => {
    expect(composeInstanceTemplate(pbIdeas).config?.hideBudget).toBe(false);
    expect(
      composeInstanceTemplate({ ...pbIdeas, type: 'other' }).config?.hideBudget,
    ).toBe(true);
  });

  it('is a template the instance builder accepts', () => {
    const instanceData = createInstanceDataFromTemplate({
      template: composeInstanceTemplate(pbIdeas),
    });

    expect(instanceData.phases.map((phase) => phase.phaseId)).toEqual([
      'submissions',
      'review',
      'submissions-2',
      'voting',
      'results',
    ]);
    expect(instanceData.phases[1]?.name).toBe('Review ideas');
  });

  it('refuses a draft with no phases', () => {
    expect(() => composeInstanceTemplate({ ...pbIdeas, phases: [] })).toThrow(
      ValidationError,
    );
  });
});

describe('blankInstanceData', () => {
  it('starts with no phases but the same process-level defaults', () => {
    const blank = blankInstanceData({
      name: 'Untitled',
      type: 'other',
      phases: [],
    });

    expect(blank.phases).toEqual([]);
    expect(blank.templateId).toBe('composed:other');
    expect(blank.proposalTemplate).toBeUndefined();
    expect(blank.config?.hideBudget).toBe(true);
  });

  it('shows budgets on a blank PB draft', () => {
    const blank = blankInstanceData({ ...pbIdeas, phases: [] });

    expect(blank.config?.hideBudget).toBe(false);
  });
});
