import { describe, expect, it } from 'vitest';

import { decodeContentRef, encodeContentRef } from './contentRef';

const POST_ID = '11111111-1111-4111-8111-111111111111';
const PROPOSAL_ID = '22222222-2222-4222-8222-222222222222';
const ROUND_ID = '99999999-9999-4999-8999-999999999999';

describe('contentRef', () => {
  it('round-trips an item ref', () => {
    const ref = encodeContentRef('post', POST_ID, ROUND_ID);
    expect(decodeContentRef(ref)).toEqual({
      itemType: 'post',
      itemId: POST_ID,
      roundId: ROUND_ID,
      mediaId: undefined,
    });
  });

  it('round-trips a per-attachment ref', () => {
    const ref = encodeContentRef('proposal', PROPOSAL_ID, ROUND_ID, '9');
    expect(decodeContentRef(ref)).toEqual({
      itemType: 'proposal',
      itemId: PROPOSAL_ID,
      roundId: ROUND_ID,
      mediaId: '9',
    });
  });

  it('throws on an unknown item type', () => {
    expect(() => decodeContentRef(`widget:${POST_ID}:${ROUND_ID}`)).toThrow();
  });

  it('throws on a malformed ref', () => {
    expect(() => decodeContentRef('garbage')).toThrow();
  });

  it('throws on a non-uuid itemId (webhook-controlled)', () => {
    expect(() => decodeContentRef(`post:not-a-uuid:${ROUND_ID}`)).toThrow();
  });

  it('throws on a ref missing the round segment', () => {
    expect(() => decodeContentRef(`post:${POST_ID}`)).toThrow();
  });

  it('throws on a non-uuid round segment (webhook-controlled)', () => {
    expect(() => decodeContentRef(`post:${POST_ID}:not-a-round`)).toThrow();
  });

  it('throws on a ref with extra segments', () => {
    expect(() =>
      decodeContentRef(`post:${POST_ID}:${ROUND_ID}:0:extra`),
    ).toThrow();
  });
});
