import { describe, expect, it } from 'vitest';

import { applyGrantDecision, piecesFor } from './content';
import {
  EMPTY_OTHER,
  composeOtherPieces,
  otherStepList,
  type OtherAnswers,
} from './otherFlow';

// The rules these cover were each decided on purpose and are easy to break
// with a plausible-looking edit — that is why they are pinned here rather than
// left to the components.

const answers = (patch: Partial<OtherAnswers>): OtherAnswers => ({
  ...EMPTY_OTHER,
  ...patch,
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
    expect(pieces[0]?.capabilities).toContain(
      'Let members comment and like to show support',
    );
  });

  it('offers a per-item vote on an always-open space only when one is wanted', () => {
    const withVote = composeOtherPieces(
      answers({ subjects: ['ideas'], cadence: 'ongoing', decision: 'vote' }),
    );
    const withoutVote = composeOtherPieces(
      answers({ subjects: ['ideas'], cadence: 'ongoing', decision: 'agree' }),
    );

    expect(withVote[0]?.capabilities).toContain(
      'Run a vote on an item when you need one',
    );
    expect(withoutVote[0]?.capabilities).not.toContain(
      'Run a vote on an item when you need one',
    );
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

    expect(intake?.capabilities).toContain(
      'Let people comment and like to show support',
    );
  });
});

describe('applyGrantDecision', () => {
  it('leaves a rubric process alone', () => {
    const pieces = piecesFor('grant', 'loi');

    expect(applyGrantDecision(pieces, 'rubric')).toBe(pieces);
    expect(applyGrantDecision(pieces, null)).toBe(pieces);
  });

  // In a letter-of-intent process the first review picks who advances, which
  // happens whoever decides the funding — so only the last review is reshaped.
  it('replaces only the last review when the applicants vote', () => {
    const reshaped = applyGrantDecision(
      piecesFor('grant', 'loi'),
      'applicants',
    );

    expect(reshaped.map((piece) => piece.phaseType)).toEqual([
      'submissions',
      'review',
      'develop',
      'voting',
      'results',
    ]);
    expect(reshaped[1]?.name).toBe('Pick a shortlist');
  });

  it('adds a vote after the narrowing review in the hybrid shape', () => {
    const reshaped = applyGrantDecision(piecesFor('grant', 'single'), 'hybrid');

    expect(reshaped.map((piece) => piece.phaseType)).toEqual([
      'submissions',
      'review',
      'voting',
      'results',
    ]);
    expect(reshaped[1]?.name).toBe('Narrow the field');
  });
});
