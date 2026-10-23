import { createTranslator } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import english from '@/lib/i18n/dictionaries/en.json';

import {
  composeOtherPieces,
  describeOther,
  subjectPhrase,
  type OtherAnswers,
} from './composeOther';
import { DECISION_OPTIONS, SUBMIT_OPTIONS } from './questions';

const EMPTY: OtherAnswers = {
  subject: null,
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
  composeOtherPieces(input).map((piece) => piece.phaseType);

describe('composeOtherPieces', () => {
  it('maps an always-open process to a single open-ended intake', () => {
    const pieces = composeOtherPieces(
      answers({
        subject: { kind: 'ideas' },
        cadence: 'ongoing',
        decision: 'agree',
      }),
    );

    expect(pieces).toHaveLength(1);
    expect(pieces[0]?.phaseType).toBe('submissions');
    expect(pieces[0]?.capabilities).toContain('letMembersCommentLikeShow');
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
    const pieces = composeOtherPieces(
      answers({ cadence: 'timeline', submits: 'rough', decision: 'review' }),
    );

    expect(pieces.map((piece) => piece.phaseType)).toEqual([
      'submissions',
      'review',
      'submissions',
      'review',
      'results',
    ]);
    expect(pieces[1]?.name).toBe('narrowDown');
    expect(pieces[3]?.name).toBe('reviewDecide');
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

  it('holds a vote on people rather than putting them to one', () => {
    const vote = (subject: OtherAnswers['subject']) =>
      composeOtherPieces(
        answers({ subject, cadence: 'timeline', decision: 'vote' }),
      ).find((piece) => piece.phaseType === 'voting')?.name;

    expect(vote({ kind: 'people' })).toBe('holdVote');
    expect(vote({ kind: 'funding' })).toBe('putVote');
  });
});

describe('subjectPhrase', () => {
  it('names the subject', () => {
    expect(subjectPhrase({ kind: 'funding' }, t)).toBe(
      english.decisions.createWizard.subjectFundingNoun,
    );
  });

  it('speaks something else in the user’s own words', () => {
    expect(subjectPhrase({ kind: 'else', text: '  A new logo ' }, t)).toBe(
      'A new logo',
    );
  });

  it('falls back to the generic noun with nothing picked or written', () => {
    expect(subjectPhrase(null, t)).toBe(
      english.decisions.createWizard.subjectElseNoun,
    );
    expect(subjectPhrase({ kind: 'else', text: '  ' }, t)).toBe(
      english.decisions.createWizard.subjectElseNoun,
    );
  });
});

describe('describeOther', () => {
  it('recaps an always-open process', () => {
    expect(
      markup(
        describeOther(
          answers({ subject: { kind: 'funding' }, cadence: 'ongoing' }),
          t,
        ),
      ),
    ).toMatch(/^Deciding on <bdi>funding<\/bdi>, always open/);
  });

  it('recaps a process with a timeline, filling every slot', () => {
    const recap = markup(
      describeOther(
        answers({
          subject: { kind: 'funding' },
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
            subject: { kind: 'else', text: 'مكان جديد!' },
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
        subject:
          subject === 'else'
            ? { kind: 'else', text: 'A new logo' }
            : { kind: subject },
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
      expect(markup(describeOther(input, t))).not.toMatch(/[{}]/);
    },
  );
});
