import type { ModerationFlag } from '@op/db/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flagItem } from './flagItem';
import { getModerationCallbackUrl } from './moderationCallback';
import { getModerationProvider } from './provider';
import { submitUserFlag } from './submitUserFlag';

vi.mock('@op/db/client', () => ({ db: { transaction: vi.fn() } }));
vi.mock('../access', () => ({
  getCurrentProfileId: vi.fn().mockResolvedValue('profile-9'),
}));
vi.mock('./assertModerationItemAccess', () => ({
  assertModerationItemAccess: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./moderationFlagStore', () => ({
  findOpenModerationFlag: vi.fn().mockResolvedValue(undefined),
  createPendingFlag: vi.fn(),
  deletePendingFlag: vi.fn(),
}));
vi.mock('./moderationSubmissionStore', () => ({
  recordSubmissionRound: vi.fn(),
  submissionMediaIdsFromRefs: vi.fn().mockReturnValue([]),
  clearSubmissions: vi.fn(),
}));
vi.mock('./resolveModerationItemText', () => ({
  resolveModerationItemText: vi.fn().mockResolvedValue('reported text'),
}));
vi.mock('./resolveModerationMedia', () => ({
  resolveModerationMedia: vi.fn().mockResolvedValue([]),
}));
vi.mock('./moderationCallback', () => ({ getModerationCallbackUrl: vi.fn() }));
vi.mock('./provider', () => ({ getModerationProvider: vi.fn() }));
vi.mock('./flagItem', () => ({
  flagItem: vi.fn().mockResolvedValue({ flag: { id: 'flag-1' } }),
}));

const pendingRow = { id: 'flag-1', status: 'pending' } as ModerationFlag;

const fullProvider = () => ({
  submitForReview: vi.fn(),
  reportForReview: vi.fn(),
  planReviewRefs: vi.fn(),
  parseWebhook: vi.fn(),
});

const input = { itemType: 'post' as const, itemId: 'p1' };

/** The deps object `submitUserFlag` handed to `flagItem`. */
const handedDeps = () => vi.mocked(flagItem).mock.calls[0]![1];

beforeEach(() => {
  vi.mocked(flagItem).mockResolvedValue({ flag: pendingRow });
  vi.mocked(flagItem).mockClear();
});

describe('submitUserFlag provider gating', () => {
  it('hands over both the submit and the report when fully configured', async () => {
    vi.mocked(getModerationProvider).mockReturnValue(fullProvider());
    vi.mocked(getModerationCallbackUrl).mockReturnValue('https://us/webhook');

    await submitUserFlag(input);

    // Both or neither: a submit without a report is the exact bug this
    // feature exists to fix (content analysed, no human-review case raised).
    expect(handedDeps().submitForReview).toBeInstanceOf(Function);
    expect(handedDeps().reportForReview).toBeInstanceOf(Function);
  });

  it('withholds the report when no callback URL is configured', async () => {
    vi.mocked(getModerationProvider).mockReturnValue(fullProvider());
    vi.mocked(getModerationCallbackUrl).mockReturnValue(null);

    await submitUserFlag(input);

    // A case whose decision webhook can't reach us can't be enforced on our
    // side, so it must not be filed — and the submit goes with it.
    expect(handedDeps().reportForReview).toBeUndefined();
    expect(handedDeps().submitForReview).toBeUndefined();
  });

  it('withholds both when no provider is configured (feature off)', async () => {
    vi.mocked(getModerationProvider).mockReturnValue(null);
    vi.mocked(getModerationCallbackUrl).mockReturnValue('https://us/webhook');

    await submitUserFlag(input);

    expect(handedDeps().submitForReview).toBeUndefined();
    expect(handedDeps().reportForReview).toBeUndefined();
  });

  it('withholds both when the provider cannot plan refs', async () => {
    const provider = fullProvider();
    vi.mocked(getModerationProvider).mockReturnValue({
      ...provider,
      planReviewRefs: undefined,
    });
    vi.mocked(getModerationCallbackUrl).mockReturnValue('https://us/webhook');

    await submitUserFlag(input);

    // Without planned refs no round is recorded, so no verdict could land.
    expect(handedDeps().submitForReview).toBeUndefined();
    expect(handedDeps().reportForReview).toBeUndefined();
  });
});
