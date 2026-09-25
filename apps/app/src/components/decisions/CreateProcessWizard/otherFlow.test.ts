import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import english from '@/lib/i18n/dictionaries/en.json';

import {
  EMPTY_OTHER,
  composeOtherPieces,
  describeOther,
  otherCanContinue,
  otherStepList,
  subjectPhrase,
  type OtherAnswers,
} from './otherFlow';

const answers = (patch: Partial<OtherAnswers>): OtherAnswers => ({
  ...EMPTY_OTHER,
  ...patch,
});

const t = createTranslator({
  locale: 'en',
  messages: english,
  namespace: 'decisions.createWizard',
});

const phases = (input: OtherAnswers) =>
  composeOtherPieces(input).map((piece) => piece.phaseType);

describe('otherStepList', () => {
  it('only asks which subject to focus on when the process has a timeline', () => {
    // Several subjects at once is only a conflict for a run with stages; an
    // always-open space covers all of them together.
    expect(
      otherStepList(
        answers({ subjects: ['funding', 'ideas'], cadence: 'timeline' }),
      ),
    ).toEqual(['subjects', 'cadence', 'focus', 'submits', 'decision']);

    expect(
      otherStepList(
        answers({ subjects: ['funding', 'ideas'], cadence: 'ongoing' }),
      ),
    ).toEqual(['subjects', 'cadence', 'submits', 'decision']);
  });

  it('does not ask about focus for a single subject', () => {
    expect(
      otherStepList(answers({ subjects: ['funding'], cadence: 'timeline' })),
    ).toEqual(['subjects', 'cadence', 'submits', 'decision']);
  });

  // The focus screen sits after the cadence question, not before it — that
  // ordering is what lets the timeline answer decide whether it is asked.
  it('puts focus after cadence', () => {
    const steps = otherStepList(
      answers({ subjects: ['funding', 'people'], cadence: 'timeline' }),
    );

    expect(steps.indexOf('focus')).toBeGreaterThan(steps.indexOf('cadence'));
  });
});

describe('composeOtherPieces', () => {
  it('maps an always-open process to a single open-ended intake', () => {
    const pieces = composeOtherPieces(
      answers({ subjects: ['ideas'], cadence: 'ongoing', decision: 'agree' }),
    );

    expect(pieces).toHaveLength(1);
    expect(pieces[0]?.phaseType).toBe('submissions');
    expect(pieces[0]?.capabilities).toContain('letMembersCommentLikeShow');
  });

  it('offers a per-item vote on an always-open space only when one is wanted', () => {
    const withVote = composeOtherPieces(
      answers({ subjects: ['ideas'], cadence: 'ongoing', decision: 'vote' }),
    );
    const withoutVote = composeOtherPieces(
      answers({ subjects: ['ideas'], cadence: 'ongoing', decision: 'agree' }),
    );

    expect(withVote[0]?.capabilities).toContain('runVoteItemWhenYou');
    expect(withoutVote[0]?.capabilities).not.toContain('runVoteItemWhenYou');
  });

  it('skips the intake when nothing is submitted', () => {
    expect(
      phases(
        answers({ cadence: 'timeline', submits: 'none', decision: 'vote' }),
      ),
    ).toEqual(['voting', 'results']);
  });

  it('adds a develop phase only for rough ideas', () => {
    expect(
      phases(
        answers({ cadence: 'timeline', submits: 'rough', decision: 'vote' }),
      ),
    ).toEqual(['submissions', 'develop', 'voting', 'results']);

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

  it('orders a review-then-vote process review, develop, vote', () => {
    expect(
      phases(
        answers({ cadence: 'timeline', submits: 'rough', decision: 'both' }),
      ),
    ).toEqual(['submissions', 'review', 'develop', 'voting', 'results']);
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
    const [intake] = composeOtherPieces(
      answers({
        cadence: 'timeline',
        submits: 'proposals',
        decision: 'agree',
      }),
    );

    expect(intake?.capabilities).toContain('letPeopleCommentLikeShow');
  });
});

describe('otherCanContinue', () => {
  it('needs at least one subject', () => {
    expect(otherCanContinue('subjects', EMPTY_OTHER)).toBe(false);
    expect(
      otherCanContinue('subjects', answers({ subjects: ['funding'] })),
    ).toBe(true);
  });

  // "Something else" is named in the user's own words, so it needs some.
  it('needs words for something else', () => {
    const picked = answers({ subjects: ['funding', 'else'] });

    expect(otherCanContinue('subjects', picked)).toBe(false);
    expect(otherCanContinue('subjects', { ...picked, elseText: '   ' })).toBe(
      false,
    );
    expect(
      otherCanContinue('subjects', { ...picked, elseText: 'A new logo' }),
    ).toBe(true);
  });

  it.each([
    ['focus', { focus: 'funding' }],
    ['cadence', { cadence: 'timeline' }],
    ['submits', { submits: 'none' }],
    ['decision', { decision: 'agree' }],
  ] as const)('needs an answer to %s', (step, answer) => {
    expect(otherCanContinue(step, EMPTY_OTHER)).toBe(false);
    expect(otherCanContinue(step, answers(answer))).toBe(true);
  });
});

describe('subjectPhrase', () => {
  it('names a single subject', () => {
    expect(subjectPhrase(answers({ subjects: ['funding'] }), t, 'en')).toBe(
      english.decisions.createWizard.subjectFundingNoun,
    );
  });

  it('joins several subjects as a list', () => {
    expect(
      subjectPhrase(answers({ subjects: ['funding', 'ideas'] }), t, 'en'),
    ).toBe('funding and ideas and priorities');
  });

  it('names only the focus when one is picked', () => {
    expect(
      subjectPhrase(
        answers({ subjects: ['funding', 'ideas'], focus: 'ideas' }),
        t,
        'en',
      ),
    ).toBe(english.decisions.createWizard.subjectIdeasNoun);
  });

  it('speaks something else in the user’s own words', () => {
    expect(
      subjectPhrase(
        answers({ subjects: ['else'], elseText: '  A new logo ' }),
        t,
        'en',
      ),
    ).toBe('A new logo');
  });
});

describe('describeOther', () => {
  it('recaps an always-open process', () => {
    expect(
      describeOther(
        answers({ subjects: ['funding'], cadence: 'ongoing' }),
        t,
        'en',
      ),
    ).toMatch(/^Deciding on funding, always open/);
  });

  it('recaps a process with a timeline, filling every slot', () => {
    const recap = describeOther(
      answers({
        subjects: ['funding'],
        cadence: 'timeline',
        submits: 'proposals',
        decision: 'vote',
      }),
      t,
      'en',
    );

    expect(recap).toMatch(/^Deciding on funding, start to finish: /);
    expect(recap).not.toMatch(/[{}]/);
  });
});
