import { createTranslator } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import english from '@/lib/i18n/dictionaries/en.json';

import {
  DECISION_OPTIONS,
  EMPTY_OTHER,
  SUBMIT_OPTIONS,
  composeOtherPieces,
  describeOther,
  needsFocus,
  otherCanContinue,
  reconcileOther,
  subjectPhrase,
  type OtherAnswers,
} from './otherFlow';
import type { WizardFlags } from './types';

const ROLLING: WizardFlags = { rollingDecisions: true };
const NO_ROLLING: WizardFlags = { rollingDecisions: false };

const answers = (patch: Partial<OtherAnswers>): OtherAnswers => ({
  ...EMPTY_OTHER,
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
  composeOtherPieces(input).map((piece) => piece.phaseType);

describe('reconcileOther', () => {
  const twoOnTimeline = answers({
    subjects: ['funding', 'people'],
    cadence: 'timeline',
    focus: 'people',
    submits: 'nominations',
  });

  it('keeps answers the others still support', () => {
    expect(reconcileOther(twoOnTimeline, ROLLING, twoOnTimeline)).toEqual(
      twoOnTimeline,
    );
  });

  it('drops the focus, and what it asked for, once the process has no end', () => {
    const ongoing = reconcileOther(
      { ...twoOnTimeline, cadence: 'ongoing' },
      ROLLING,
      twoOnTimeline,
    );

    expect(ongoing.focus).toBeNull();
    expect(ongoing.submits).toBeNull();
  });

  it('drops a focus that is no longer among the subjects', () => {
    expect(
      reconcileOther(
        { ...twoOnTimeline, subjects: ['funding', 'ideas'] },
        ROLLING,
        twoOnTimeline,
      ).focus,
    ).toBeNull();
  });

  it('keeps what is submitted when one subject remains and it was the focus', () => {
    const narrowed = reconcileOther(
      { ...twoOnTimeline, subjects: ['people'] },
      ROLLING,
      twoOnTimeline,
    );

    expect(narrowed.focus).toBeNull();
    expect(narrowed.submits).toBe('nominations');
  });

  it('drops what is submitted when the subject changes, even to one offering the same key', () => {
    const funding = answers({ subjects: ['funding'], submits: 'applications' });

    expect(
      reconcileOther({ ...funding, subjects: ['people'] }, ROLLING, funding)
        .submits,
    ).toBeNull();
  });

  it('drops a submission the subject does not offer, with nothing to compare against', () => {
    expect(
      reconcileOther(
        answers({ subjects: ['funding'], submits: 'nominations' }),
        ROLLING,
      ).submits,
    ).toBeNull();
  });

  it('drops the words for something else once it is unticked', () => {
    expect(
      reconcileOther(
        answers({ subjects: ['funding'], elseText: 'A new logo' }),
        ROLLING,
      ).elseText,
    ).toBe('');
  });

  it('forgets an always-open answer once rolling decisions are off, keeping the focus', () => {
    const ongoing = { ...twoOnTimeline, cadence: 'ongoing' as const };

    expect(reconcileOther(ongoing, ROLLING).cadence).toBe('ongoing');
    expect(reconcileOther(ongoing, NO_ROLLING)).toEqual({
      ...twoOnTimeline,
      cadence: null,
    });
  });
});

describe('needsFocus', () => {
  it('treats an unasked cadence as a process with an end', () => {
    const several = answers({ subjects: ['funding', 'people'] });

    expect(needsFocus(several)).toBe(true);
    expect(needsFocus({ ...several, cadence: 'timeline' })).toBe(true);
    expect(needsFocus({ ...several, cadence: 'ongoing' })).toBe(false);
    expect(needsFocus(answers({ subjects: ['funding'] }))).toBe(false);
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
    ).toBe(
      `${english.decisions.createWizard.subjectFundingNoun} and ${english.decisions.createWizard.subjectIdeasNoun}`,
    );
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
      markup(
        describeOther(
          answers({ subjects: ['funding'], cadence: 'ongoing' }),
          t,
          'en',
        ),
      ),
    ).toMatch(/^Deciding on <bdi>funding<\/bdi>, always open/);
  });

  it('recaps a process with a timeline, filling every slot', () => {
    const recap = markup(
      describeOther(
        answers({
          subjects: ['funding'],
          cadence: 'timeline',
          submits: 'proposals',
          decision: 'vote',
        }),
        t,
        'en',
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
            subjects: ['else'],
            elseText: 'مكان جديد!',
            cadence: 'ongoing',
          }),
          t,
          'en',
        ),
      ),
    ).toContain('<bdi>مكان جديد!</bdi>');
  });
});

describe('every process the other questions compose', () => {
  const cases = (['timeline', 'ongoing'] as const).flatMap((cadence) =>
    (['funding', 'ideas', 'people', 'else'] as const).flatMap((subject) =>
      SUBMIT_OPTIONS[subject].flatMap((submits) =>
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
        subjects: [subject],
        elseText: subject === 'else' ? 'A new logo' : '',
        cadence,
        submits,
        decision,
      });
      const pieces = composeOtherPieces(input);
      const phaseNames = pieces.map((piece) => piece.phaseName ?? piece.name);
      const keys = pieces.flatMap((piece) => [
        piece.name,
        piece.phaseName,
        piece.description,
        piece.norm,
        ...piece.capabilities,
      ]);

      expect(pieces.length).toBeGreaterThan(0);
      expect(new Set(phaseNames).size).toBe(phaseNames.length);
      expect(keys.filter((key) => key !== undefined && !(key in copy))).toEqual(
        [],
      );
      expect(markup(describeOther(input, t, 'en'))).not.toMatch(/[{}]/);
    },
  );
});
