import { describe, expect, it, vi } from 'vitest';

import { ModerationError } from '../../utils';
import { assertTextContentModerated } from './assertTextContentModerated';
import { moderateTextContent } from './moderateTextContent';
import type { ModerationProvider, ModerationScores } from './types';

const fakeProvider = (scores: ModerationScores): ModerationProvider => ({
  scoreText: async () => scores,
});

const throwingProvider = (): ModerationProvider => ({
  scoreText: async () => {
    throw new Error('provider exploded');
  },
});

describe('moderateTextContent', () => {
  it('passes when summed scores are below the threshold', async () => {
    const decision = await moderateTextContent(
      'a perfectly nice message',
      fakeProvider({ profanity: 0.1, hate: 0.2 }),
    );

    expect(decision.passed).toBe(true);
    expect(decision.total).toBeCloseTo(0.3);
  });

  it('fails when summed scores meet or exceed the threshold', async () => {
    const decision = await moderateTextContent(
      'something nasty',
      fakeProvider({ profanity: 0.9, hate: 0.5 }),
    );

    expect(decision.passed).toBe(false);
    expect(decision.total).toBeCloseTo(1.4);
  });

  it('passes empty/whitespace-only content without calling the provider', async () => {
    const scoreText = vi.fn();

    const decision = await moderateTextContent('   \n  ', { scoreText });

    expect(decision.passed).toBe(true);
    expect(decision.total).toBe(0);
    expect(scoreText).not.toHaveBeenCalled();
  });

  it('ignores non-numeric scores from a misbehaving provider', async () => {
    const decision = await moderateTextContent('hello', {
      // Provider contract says numbers; guard against junk at runtime.
      scoreText: async () =>
        ({ profanity: 'high', hate: 0.2 }) as unknown as ModerationScores,
    });

    expect(decision.passed).toBe(true);
    expect(decision.total).toBeCloseTo(0.2);
  });

  it('propagates the error when the provider throws (fail-closed)', async () => {
    await expect(
      moderateTextContent('content that errors', throwingProvider()),
    ).rejects.toThrow('provider exploded');
  });

  it('passes when no provider is configured (feature off)', async () => {
    const decision = await moderateTextContent('any content at all', null);

    expect(decision.passed).toBe(true);
    expect(decision.total).toBe(0);
  });
});

describe('assertTextContentModerated', () => {
  it('returns the decision when content passes', async () => {
    const decision = await assertTextContentModerated(
      'a friendly message',
      fakeProvider({ profanity: 0.1 }),
    );

    expect(decision.passed).toBe(true);
  });

  it('throws ModerationError when content fails', async () => {
    await expect(
      assertTextContentModerated('something nasty', fakeProvider({ hate: 2 })),
    ).rejects.toBeInstanceOf(ModerationError);
  });
});
