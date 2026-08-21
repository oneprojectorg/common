import { describe, expect, it } from 'vitest';

import { toOverviewInput, toPhasesInput } from './headlinePatch';

describe('toOverviewInput', () => {
  it('sends an emptied headline as an explicit clear', () => {
    expect(toOverviewInput({ headline: '', description: 'Desc' })).toEqual({
      headline: null,
      description: 'Desc',
    });
    expect(toOverviewInput({ headline: '   ' })).toEqual({ headline: null });
  });

  it('passes a real headline through untrimmed', () => {
    expect(toOverviewInput({ headline: 'Welcome' })).toEqual({
      headline: 'Welcome',
    });
  });

  it('leaves an untouched headline absent', () => {
    // An absent key means "unchanged" — adding `headline: null` here would
    // clear a headline the admin never edited.
    expect(toOverviewInput({ description: 'Desc' })).toEqual({
      description: 'Desc',
    });
    expect(toOverviewInput(undefined)).toBeUndefined();
  });
});

describe('toPhasesInput', () => {
  it('clears only the phases whose headline was emptied', () => {
    expect(
      toPhasesInput([
        { phaseId: 'a', headline: '' },
        { phaseId: 'b', headline: 'Share your ideas' },
        { phaseId: 'c', name: 'No headline edit' },
      ]),
    ).toEqual([
      { phaseId: 'a', headline: null },
      { phaseId: 'b', headline: 'Share your ideas' },
      { phaseId: 'c', name: 'No headline edit' },
    ]);
  });

  it('passes undefined through', () => {
    expect(toPhasesInput(undefined)).toBeUndefined();
  });
});
