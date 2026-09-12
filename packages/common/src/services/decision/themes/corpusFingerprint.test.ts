import { describe, expect, it } from 'vitest';

import { fingerprintCorpus } from './corpusFingerprint';

const proposalA = {
  index: 1,
  id: 'a',
  profileId: 'profile-a',
  title: 'Bike lanes',
  text: 'Build bike lanes',
};

const proposalB = {
  index: 2,
  id: 'b',
  profileId: 'profile-b',
  title: 'Bus lanes',
  text: 'Build bus lanes',
};

describe('fingerprintCorpus', () => {
  it('is the same for the same corpus', () => {
    expect(fingerprintCorpus([proposalA, proposalB])).toBe(
      fingerprintCorpus([proposalA, proposalB]),
    );
  });

  // The readers do not promise an order, and the stored result carries ids
  // rather than positions, so a reshuffle is the same corpus.
  it('ignores the order the proposals came back in', () => {
    expect(fingerprintCorpus([proposalB, proposalA])).toBe(
      fingerprintCorpus([
        { ...proposalA, index: 2 },
        { ...proposalB, index: 1 },
      ]),
    );
  });

  it('changes when a proposal is added', () => {
    expect(fingerprintCorpus([proposalA])).not.toBe(
      fingerprintCorpus([proposalA, proposalB]),
    );
  });

  it('changes when a body the model would read changes', () => {
    expect(fingerprintCorpus([proposalA])).not.toBe(
      fingerprintCorpus([{ ...proposalA, text: 'Build wider bike lanes' }]),
    );
  });

  it('changes when a title changes', () => {
    expect(fingerprintCorpus([proposalA])).not.toBe(
      fingerprintCorpus([{ ...proposalA, title: 'Cycle lanes' }]),
    );
  });

  // Two different corpora must not collide by concatenation: `ab` + `c` and
  // `a` + `bc` are told apart because each field is its own JSON string.
  it('does not collide on field boundaries', () => {
    expect(
      fingerprintCorpus([{ ...proposalA, title: 'ab', text: 'c' }]),
    ).not.toBe(fingerprintCorpus([{ ...proposalA, title: 'a', text: 'bc' }]));
  });
});
