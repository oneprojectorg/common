import { describe, expect, it } from 'vitest';

import english from '@/lib/i18n/dictionaries/en.json';

import { applyGrantDecision, presetPhases } from './phasePresets';
import { GRANT_DECISION_OPTIONS, SHAPE_QUESTION } from './questions';
import type { WizardPhase } from './types';

const copy: Record<string, unknown> = english.decisions.createWizard;

const keysOf = (phase: WizardPhase) =>
  [
    phase.name,
    phase.phaseName,
    phase.description,
    phase.norm,
    ...phase.capabilities,
  ].filter((key) => key !== undefined);

describe('applyGrantDecision', () => {
  it('leaves a rubric process alone', () => {
    const phases = presetPhases('loi');

    expect(applyGrantDecision(phases, 'rubric')).toBe(phases);
    expect(applyGrantDecision(phases, null)).toBe(phases);
  });

  it('replaces only the last review when the applicants vote', () => {
    const reshaped = applyGrantDecision(presetPhases('loi'), 'applicants');

    expect(reshaped.map((phase) => phase.kind)).toEqual([
      'submissions',
      'review',
      'submissions',
      'voting',
      'results',
    ]);
    expect(reshaped[1]?.name).toBe('pickShortlist');
    expect(reshaped[3]?.phaseName).toBe('votePhase');
  });

  it('adds a vote after the narrowing review in the hybrid shape', () => {
    const reshaped = applyGrantDecision(presetPhases('single'), 'hybrid');

    expect(reshaped.map((phase) => phase.kind)).toEqual([
      'submissions',
      'review',
      'voting',
      'results',
    ]);
    expect(reshaped[1]?.name).toBe('narrowField');
    expect(reshaped[1]?.phaseName).toBe('pickFinalists');
    expect(reshaped[2]?.phaseName).toBe('votePhase');
  });

  it('keeps the letter shortlist apart from the finalists in the hybrid shape', () => {
    const reshaped = applyGrantDecision(presetPhases('loi'), 'hybrid');

    expect(reshaped.map((phase) => phase.phaseName)).toEqual([
      'sendLetterIntent',
      'shortlisting',
      'sendYourApplication',
      'pickFinalists',
      'votePhase',
      'seeAwards',
    ]);
  });
});

describe('every grantmaking and budgeting process', () => {
  const grantDecisions = [
    null,
    ...GRANT_DECISION_OPTIONS.map((option) => option.key),
  ];
  const cases = (['grant', 'pb'] as const).flatMap((type) =>
    SHAPE_QUESTION[type].options.flatMap((shape) =>
      (type === 'grant' ? grantDecisions : [null]).map(
        (decision) => [shape.key, decision] as const,
      ),
    ),
  );

  it.each(cases)('%s decided by %s', (shape, decision) => {
    const phases = applyGrantDecision(presetPhases(shape), decision);
    const phaseNames = phases.map((phase) => phase.phaseName);

    expect(phases.length).toBeGreaterThan(1);
    expect(phases.at(-1)?.kind).toBe('results');
    expect(new Set(phaseNames).size).toBe(phaseNames.length);
    expect(phases.flatMap(keysOf).filter((key) => !(key in copy))).toEqual([]);
  });
});

describe('presetPhases', () => {
  it('builds nothing before a shape is picked', () => {
    expect(presetPhases(null)).toEqual([]);
  });
});
