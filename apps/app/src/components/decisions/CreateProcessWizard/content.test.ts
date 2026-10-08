import { describe, expect, it } from 'vitest';

import { applyGrantDecision, piecesFor } from './content';

describe('applyGrantDecision', () => {
  it('leaves a rubric process alone', () => {
    const pieces = piecesFor('grant', 'loi');

    expect(applyGrantDecision(pieces, 'rubric')).toBe(pieces);
    expect(applyGrantDecision(pieces, null)).toBe(pieces);
  });

  it('replaces only the last review when the applicants vote', () => {
    const reshaped = applyGrantDecision(
      piecesFor('grant', 'loi'),
      'applicants',
    );

    expect(reshaped.map((piece) => piece.phaseType)).toEqual([
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
    const reshaped = applyGrantDecision(piecesFor('grant', 'single'), 'hybrid');

    expect(reshaped.map((piece) => piece.phaseType)).toEqual([
      'submissions',
      'review',
      'voting',
      'results',
    ]);
    expect(reshaped[1]?.name).toBe('narrowField');
    expect(reshaped[1]?.phaseName).toBe('shortlisting');
    expect(reshaped[2]?.phaseName).toBe('votePhase');
  });
});
