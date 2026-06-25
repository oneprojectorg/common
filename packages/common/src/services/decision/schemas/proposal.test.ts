import { describe, expect, it } from 'vitest';

import {
  PROPOSAL_SUBMITTER_FACE_PILE_MAX,
  proposalSubmittersListSchema,
} from './proposal';

describe('proposalSubmittersListSchema', () => {
  const sampleEntry = {
    slug: 'alice',
    name: 'Alice',
    avatarImage: { name: 'avatars/alice.png' },
  };

  it('accepts a sample at the cap and a larger reported total', () => {
    const atCap = Array.from(
      { length: PROPOSAL_SUBMITTER_FACE_PILE_MAX },
      () => sampleEntry,
    );

    const parsed = proposalSubmittersListSchema.parse({
      submitters: atCap,
      total: 9999,
    });

    expect(parsed.submitters).toHaveLength(PROPOSAL_SUBMITTER_FACE_PILE_MAX);
    expect(parsed.total).toBe(9999);
  });

  it('rejects a sample that exceeds the face-pile cap', () => {
    const overCap = Array.from(
      { length: PROPOSAL_SUBMITTER_FACE_PILE_MAX + 1 },
      () => sampleEntry,
    );

    expect(() =>
      proposalSubmittersListSchema.parse({
        submitters: overCap,
        total: overCap.length,
      }),
    ).toThrow();
  });
});
