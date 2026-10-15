import { describe, expect, it } from 'vitest';

import english from '@/lib/i18n/dictionaries/en.json';

import {
  GRANT_DECISION_QUESTION,
  SHAPE_QUESTION,
  applyGrantDecision,
  piecesFor,
} from './content';
import type { ProcessPiece } from './types';

const copy: Record<string, unknown> = english.decisions.createWizard;

const keysOf = (piece: ProcessPiece) =>
  [
    piece.name,
    piece.phaseName,
    piece.description,
    piece.norm,
    ...piece.capabilities,
  ].filter((key) => key !== undefined);

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
    expect(reshaped[1]?.phaseName).toBe('pickFinalists');
    expect(reshaped[2]?.phaseName).toBe('votePhase');
  });

  it('keeps the letter shortlist apart from the finalists in the hybrid shape', () => {
    const reshaped = applyGrantDecision(piecesFor('grant', 'loi'), 'hybrid');

    expect(reshaped.map((piece) => piece.phaseName)).toEqual([
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
    ...GRANT_DECISION_QUESTION.options.map((option) => option.key),
  ];
  const cases = (['grant', 'pb'] as const).flatMap((type) =>
    (SHAPE_QUESTION[type]?.options ?? []).flatMap((shape) =>
      (type === 'grant' ? grantDecisions : [null]).map(
        (decision) => [type, shape.key, decision] as const,
      ),
    ),
  );

  it.each(cases)('%s %s decided by %s', (type, shape, decision) => {
    const pieces = applyGrantDecision(piecesFor(type, shape), decision);
    const phaseNames = pieces.map((piece) => piece.phaseName ?? piece.name);

    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.at(-1)?.phaseType).toBe('results');
    expect(new Set(phaseNames).size).toBe(phaseNames.length);
    expect(pieces.flatMap(keysOf).filter((key) => !(key in copy))).toEqual([]);
  });
});

describe('piecesFor', () => {
  it.each([
    [null, 'single'],
    ['grant', null],
    ['grant', 'ideas'],
    ['other', 'custom'],
  ] as const)('builds nothing for %s %s', (type, shape) => {
    expect(piecesFor(type, shape)).toEqual([]);
  });
});
