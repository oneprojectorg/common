import { createTranslator } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import english from '@/lib/i18n/dictionaries/en.json';

import { EMPTY_ANSWERS, type WizardAnswers } from './flow';
import {
  applyGrantDecision,
  composeOtherPhases,
  describeOther,
  phasesFor,
  presetPhases,
  subjectPhrase,
} from './phases';
import {
  DECISION_OPTIONS,
  GRANT_DECISION_OPTIONS,
  SHAPE_QUESTION,
  SUBJECT_META,
} from './questions';

const answers = (patch: Partial<WizardAnswers>): WizardAnswers => ({
  ...EMPTY_ANSWERS,
  ...patch,
});

const t = createTranslator({
  locale: 'en',
  messages: english,
  namespace: 'decisions.createWizard',
});

const markup = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);

const kinds = (input: WizardAnswers) =>
  composeOtherPhases(input).map((phase) => phase.kind);

describe('phasesFor', () => {
  it('builds nothing before a shape is picked', () => {
    expect(phasesFor(answers({ type: 'pb' }))).toEqual([]);
  });

  it('reshapes a grant by who decides', () => {
    expect(
      phasesFor(
        answers({
          type: 'grant',
          shape: 'single',
          grantDecision: 'applicants',
        }),
      ).map((phase) => phase.kind),
    ).toEqual(['submissions', 'voting', 'results']);
  });

  it('ignores a grant decision on a budgeting process', () => {
    expect(
      phasesFor(
        answers({
          type: 'pb',
          shape: 'proposals',
          grantDecision: 'applicants',
        }),
      ),
    ).toEqual(presetPhases('proposals'));
  });

  it('composes the other pathway from its questions', () => {
    expect(
      phasesFor(answers({ type: 'other', cadence: 'ongoing' })),
    ).toHaveLength(1);
  });
});

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
        (grantDecision) => [type, shape.key, grantDecision] as const,
      ),
    ),
  );

  it.each(cases)('%s %s decided by %s', (type, shape, grantDecision) => {
    const phases = phasesFor(answers({ type, shape, grantDecision }));
    const phaseNames = phases.map((phase) => phase.phaseName);

    expect(phases.length).toBeGreaterThan(1);
    expect(phases.at(-1)?.kind).toBe('results');
    expect(new Set(phaseNames).size).toBe(phaseNames.length);
  });
});

describe('composeOtherPhases', () => {
  it('maps an always-open process to a single open-ended intake', () => {
    const phases = composeOtherPhases(
      answers({
        subject: 'ideas',
        cadence: 'ongoing',
        decision: 'agree',
      }),
    );

    expect(phases).toHaveLength(1);
    expect(phases[0]?.kind).toBe('submissions');
    expect(phases[0]?.capabilities).toContain('letMembersCommentLikeShow');
  });

  it('skips the intake when nothing is submitted', () => {
    expect(
      kinds(
        answers({ cadence: 'timeline', submits: 'none', decision: 'vote' }),
      ),
    ).toEqual(['voting', 'results']);
  });

  it('adds a second submissions phase only for rough ideas', () => {
    expect(
      kinds(
        answers({ cadence: 'timeline', submits: 'rough', decision: 'vote' }),
      ),
    ).toEqual(['submissions', 'submissions', 'voting', 'results']);

    expect(
      kinds(
        answers({
          cadence: 'timeline',
          submits: 'proposals',
          decision: 'vote',
        }),
      ),
    ).toEqual(['submissions', 'voting', 'results']);
  });

  it('orders a review-then-vote process review, submissions, vote', () => {
    expect(
      kinds(
        answers({ cadence: 'timeline', submits: 'rough', decision: 'both' }),
      ),
    ).toEqual(['submissions', 'review', 'submissions', 'voting', 'results']);
  });

  it('narrows rough ideas down before the smaller group decides on the fuller versions', () => {
    const phases = composeOtherPhases(
      answers({ cadence: 'timeline', submits: 'rough', decision: 'review' }),
    );

    expect(phases.map((phase) => phase.kind)).toEqual([
      'submissions',
      'review',
      'submissions',
      'review',
      'results',
    ]);
    expect(phases[1]?.name).toBe('narrowDown');
    expect(phases[3]?.name).toBe('reviewDecide');
  });

  it('leaves out voting when a smaller group decides', () => {
    expect(
      kinds(
        answers({
          cadence: 'timeline',
          submits: 'applications',
          decision: 'review',
        }),
      ),
    ).toEqual(['submissions', 'review', 'results']);
  });

  it('carries support into the intake when there is no formal vote', () => {
    const [intake] = composeOtherPhases(
      answers({
        cadence: 'timeline',
        submits: 'proposals',
        decision: 'agree',
      }),
    );

    expect(intake?.capabilities).toContain('letPeopleCommentLikeShow');
  });

  it('holds a vote on people rather than putting them to one', () => {
    const vote = (subject: WizardAnswers['subject']) =>
      composeOtherPhases(
        answers({ subject, cadence: 'timeline', decision: 'vote' }),
      ).find((phase) => phase.kind === 'voting')?.name;

    expect(vote('people')).toBe('holdVote');
    expect(vote('funding')).toBe('putVote');
  });
});

describe('subjectPhrase', () => {
  it('names the subject', () => {
    expect(subjectPhrase(answers({ subject: 'funding' }), t)).toBe(
      english.decisions.createWizard.subjectFundingNoun,
    );
  });

  it('speaks something else in the user’s own words', () => {
    expect(
      subjectPhrase(
        answers({ subject: 'else', subjectText: '  A new logo ' }),
        t,
      ),
    ).toBe('A new logo');
  });

  it('falls back to the generic noun with nothing picked or written', () => {
    expect(subjectPhrase(EMPTY_ANSWERS, t)).toBe(
      english.decisions.createWizard.subjectElseNoun,
    );
    expect(
      subjectPhrase(answers({ subject: 'else', subjectText: '  ' }), t),
    ).toBe(english.decisions.createWizard.subjectElseNoun);
  });
});

describe('describeOther', () => {
  it('recaps an always-open process', () => {
    expect(
      markup(
        describeOther(answers({ subject: 'funding', cadence: 'ongoing' }), t),
      ),
    ).toMatch(/^Deciding on <bdi>funding<\/bdi>, always open/);
  });

  it('recaps a process with a timeline, filling every slot', () => {
    const recap = markup(
      describeOther(
        answers({
          subject: 'funding',
          cadence: 'timeline',
          submits: 'proposals',
          decision: 'vote',
        }),
        t,
      ),
    );

    expect(recap).toMatch(
      /^Deciding on <bdi>funding<\/bdi>, start to finish: /,
    );
    expect(recap).not.toMatch(/[{}]/);
  });

  it('isolates the user’s own words from the sentence around them', () => {
    expect(
      markup(
        describeOther(
          answers({
            subject: 'else',
            subjectText: 'مكان جديد!',
            cadence: 'ongoing',
          }),
          t,
        ),
      ),
    ).toContain('<bdi>مكان جديد!</bdi>');
  });
});

describe('every process the other questions compose', () => {
  const cases = (['timeline', 'ongoing'] as const).flatMap((cadence) =>
    (['funding', 'ideas', 'people', 'else'] as const).flatMap((subject) =>
      SUBJECT_META[subject].submitOptions.flatMap((submits) =>
        DECISION_OPTIONS.map(
          (decision) => [cadence, subject, submits.key, decision.key] as const,
        ),
      ),
    ),
  );

  it.each(cases)(
    '%s, %s, %s, decided by %s',
    (cadence, subject, submits, decision) => {
      const input = answers({
        type: 'other',
        subject,
        subjectText: subject === 'else' ? 'A new logo' : '',
        cadence,
        submits,
        decision,
      });
      const phases = phasesFor(input);
      const phaseNames = phases.map((phase) => phase.phaseName);

      expect(phases.length).toBeGreaterThan(0);
      expect(new Set(phaseNames).size).toBe(phaseNames.length);
      expect(markup(describeOther(input, t))).not.toMatch(/[{}]/);
    },
  );
});
