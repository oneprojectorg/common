import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../utils';
import {
  type WizardDraft,
  blankWizardInstanceData,
  composeWizardTemplate,
} from './composeWizardTemplate';
import { simpleVoting } from './schemas/definitions';
import { createInstanceDataFromTemplate } from './schemas/instanceData';
import { isReviewPhase } from './utils/phaseSettings';

const pbIdeas: WizardDraft = {
  name: 'Neighbourhood fund',
  type: 'pb',
  shape: 'ideas',
  phases: [
    { kind: 'submissions', name: 'Share your ideas' },
    { kind: 'review', name: 'Review ideas' },
    { kind: 'submissions', name: 'Build proposals' },
    { kind: 'voting', name: 'Vote' },
    { kind: 'results', name: 'See results' },
  ],
};

describe('composeWizardTemplate', () => {
  it('names the template after the process and ids it by the answers', () => {
    const template = composeWizardTemplate(pbIdeas);

    expect(template.id).toBe('wizard:pb:ideas');
    expect(template.name).toBe('Neighbourhood fund');
    expect(template.proposalTemplate).toEqual(simpleVoting.proposalTemplate);
  });

  it('keeps the phases in order with the names the creator saw', () => {
    const template = composeWizardTemplate(pbIdeas);

    expect(template.phases.map((phase) => phase.name)).toEqual(
      pbIdeas.phases.map((phase) => phase.name),
    );
  });

  it('gives a repeated kind a distinct id', () => {
    const template = composeWizardTemplate(pbIdeas);

    expect(template.phases.map((phase) => phase.id)).toEqual([
      'submissions',
      'review',
      'submissions-2',
      'voting',
      'results',
    ]);
  });

  it('lets each kind do only its own thing', () => {
    const [intake, review, develop, vote, results] =
      composeWizardTemplate(pbIdeas).phases;

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
    for (const phase of composeWizardTemplate(pbIdeas).phases) {
      expect(phase.rules.advancement).toEqual({ method: 'manual' });
    }
  });

  it('carries the seeded settings forms and drops the pipeline off the last phase', () => {
    const template = composeWizardTemplate(pbIdeas);
    const vote = template.phases[3];
    const results = template.phases[4];

    expect(vote?.settings?.properties).toHaveProperty('maxVotesPerMember');
    expect(vote?.selectionPipeline).toBeDefined();
    expect(results?.selectionPipeline).toBeUndefined();
  });

  it('hides budgets only for a process that is neither grants nor PB', () => {
    expect(composeWizardTemplate(pbIdeas).config?.hideBudget).toBe(false);
    expect(
      composeWizardTemplate({ ...pbIdeas, type: 'other', shape: 'custom' })
        .config?.hideBudget,
    ).toBe(true);
  });

  it('is a template the instance builder accepts', () => {
    const instanceData = createInstanceDataFromTemplate({
      template: composeWizardTemplate(pbIdeas),
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
    expect(() => composeWizardTemplate({ ...pbIdeas, phases: [] })).toThrow(
      ValidationError,
    );
  });
});

describe('blankWizardInstanceData', () => {
  it('starts with no phases but the same process-level defaults', () => {
    const blank = blankWizardInstanceData({
      name: 'Untitled',
      type: 'other',
      shape: 'blank',
      phases: [],
    });

    expect(blank.phases).toEqual([]);
    expect(blank.templateId).toBe('wizard:other:blank');
    expect(blank.proposalTemplate).toEqual(simpleVoting.proposalTemplate);
    expect(blank.config?.hideBudget).toBe(true);
  });
});
