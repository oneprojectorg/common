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

  it('writes no key other than the headline', () => {
    // Clearing the headline must not disturb the rest of the patch — the
    // endpoint merges what it receives into the stored overview.
    expect(
      toOverviewInput({
        headline: '',
        description: 'Desc',
        body: { type: 'doc', content: [] },
        heroImage: 'decisions/hero.png',
      }),
    ).toEqual({
      headline: null,
      description: 'Desc',
      body: { type: 'doc', content: [] },
      heroImage: 'decisions/hero.png',
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

  it('writes no key other than the headline', () => {
    expect(
      toPhasesInput([
        {
          phaseId: 'a',
          headline: '',
          name: 'Submit',
          endDate: '2026-01-01',
          settings: { allowComments: true },
        },
      ]),
    ).toEqual([
      {
        phaseId: 'a',
        headline: null,
        name: 'Submit',
        endDate: '2026-01-01',
        settings: { allowComments: true },
      },
    ]);
  });

  it('passes undefined through', () => {
    expect(toPhasesInput(undefined)).toBeUndefined();
  });
});
