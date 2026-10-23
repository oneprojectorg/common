import { createTranslator } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import english from '@/lib/i18n/dictionaries/en.json';

import {
  composeOtherPhases,
  describeOther,
  subjectPhrase,
  type OtherAnswers,
} from './composeOther';
import { DECISION_OPTIONS, SUBJECT_META } from './questions';

const EMPTY: OtherAnswers = {
  subject: null,
  subjectText: '',
  cadence: null,
  submits: null,
  decision: null,
};

const answers = (patch: Partial<OtherAnswers>): OtherAnswers => ({
  ...EMPTY,
  ...patch,
});

const t = createTranslator({
  locale: 'en',
  messages: english,
  namespace: 'decisions.createWizard',
});

const copy: Record<string, unknown> = english.decisions.createWizard;

const markup = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);

const phases = (input: OtherAnswers) =>
  composeOtherPhases(input).map((phase) => phase.kind);

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
      phases(
        answers({ cadence: 'timeline', submits: 'none', decision: 'vote' }),
      ),
    ).toEqual(['voting', 'results']);
  });

  it('adds a second submissions phase only for rough ideas', () => {
    expect(
      phases(
        answers({ cadence: 'timeline', submits: 'rough', decision: 'vote' }),
      ),
    ).toEqual(['submissions', 'submissions', 'voting', 'results']);

    expect(
      phases(
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
      phases(
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
      phases(
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
    const vote = (subject: OtherAnswers['subject']) =>
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
    expect(subjectPhrase(EMPTY, t)).toBe(
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
        subject,
        subjectText: subject === 'else' ? 'A new logo' : '',
        cadence,
        submits,
        decision,
      });
      const phases = composeOtherPhases(input);
      const phaseNames = phases.map((phase) => phase.phaseName);
      const keys = phases.flatMap((phase) => [
        phase.name,
        phase.phaseName,
        phase.description,
        phase.norm,
        ...phase.capabilities,
      ]);

      expect(phases.length).toBeGreaterThan(0);
      expect(new Set(phaseNames).size).toBe(phaseNames.length);
      expect(keys.filter((key) => key !== undefined && !(key in copy))).toEqual(
        [],
      );
      expect(markup(describeOther(input, t))).not.toMatch(/[{}]/);
    },
  );
});
