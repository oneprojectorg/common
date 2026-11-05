import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PENDING_ENGAGEMENT_PARAM,
  clearPendingEngagementProof,
  decideResumeStep,
  joinPromptKeys,
  parseJoinParam,
  parsePendingEngagement,
  readPendingEngagementProof,
  savePendingEngagementProof,
  serializePendingEngagement,
  withPendingEngagement,
} from './pendingEngagement';

const profileId = '92bac10d-d6a6-4907-91b8-2f6f2f961afc';

describe('parseJoinParam', () => {
  it('stays closed without a join param', () => {
    expect(parseJoinParam(null)).toBeNull();
    expect(parseJoinParam('')).toBeNull();
  });

  it('opens the generic prompt for the legacy deep link', () => {
    expect(parseJoinParam('1')).toBe('generic');
  });

  it('opens the matching prompt for a like or follow trigger', () => {
    expect(parseJoinParam('like')).toBe('like');
    expect(parseJoinParam('follow')).toBe('follow');
  });

  it('falls back to the generic prompt for an unknown value', () => {
    expect(parseJoinParam('propose')).toBe('generic');
  });
});

describe('joinPromptKeys', () => {
  it('keeps the existing pair for the generic and like prompts', () => {
    expect(joinPromptKeys('generic')).toEqual({
      title: 'decisions.joinPromptTitle',
      description: 'decisions.joinPromptDescription',
    });
    expect(joinPromptKeys('like')).toEqual({
      title: 'decisions.joinPromptTitle',
      description: 'decisions.joinPromptDescription',
    });
  });

  it('gives the follow prompt its own pair', () => {
    expect(joinPromptKeys('follow')).toEqual({
      title: 'decisions.joinPromptFollowTitle',
      description: 'decisions.joinPromptFollowDescription',
    });
  });
});

describe('pending engagement codec', () => {
  it('round-trips a like and a follow', () => {
    for (const action of ['like', 'follow'] as const) {
      const raw = serializePendingEngagement({ action, profileId });
      expect(raw).toBe(`${action}:${profileId}`);
      expect(parsePendingEngagement(raw)).toEqual({ action, profileId });
    }
  });

  it('rejects a missing, malformed, or tampered value', () => {
    expect(parsePendingEngagement(null)).toBeNull();
    expect(parsePendingEngagement('')).toBeNull();
    expect(parsePendingEngagement('like:')).toBeNull();
    expect(parsePendingEngagement(`vote:${profileId}`)).toBeNull();
    expect(parsePendingEngagement('like:not-a-uuid')).toBeNull();
    expect(parsePendingEngagement(`like:${profileId}:extra`)).toBeNull();
  });
});

describe('withPendingEngagement', () => {
  it('appends a valid pending action to the destination', () => {
    const raw = serializePendingEngagement({ action: 'follow', profileId });
    expect(withPendingEngagement('/en/decisions/x', raw)).toBe(
      `/en/decisions/x?${PENDING_ENGAGEMENT_PARAM}=follow%3A${profileId}`,
    );
  });

  it('returns the bare destination when the value is absent or malformed', () => {
    expect(withPendingEngagement('/en/decisions/x', null)).toBe(
      '/en/decisions/x',
    );
    expect(withPendingEngagement('/en/decisions/x', 'like:nope')).toBe(
      '/en/decisions/x',
    );
  });
});

describe('pending engagement proof storage', () => {
  const makeStorage = () => {
    const entries = new Map<string, string>();
    return {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value);
      },
      removeItem: (key: string) => {
        entries.delete(key);
      },
    };
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips a saved proof and clears it', () => {
    vi.stubGlobal('sessionStorage', makeStorage());
    const raw = serializePendingEngagement({ action: 'like', profileId });
    savePendingEngagementProof(raw);
    expect(readPendingEngagementProof()).toBe(raw);
    clearPendingEngagementProof();
    expect(readPendingEngagementProof()).toBeNull();
  });

  it('degrades to no proof when storage is unavailable', () => {
    vi.stubGlobal('sessionStorage', undefined);
    expect(() => savePendingEngagementProof('like:x')).not.toThrow();
    expect(readPendingEngagementProof()).toBeNull();
    expect(() => clearPendingEngagementProof()).not.toThrow();
  });

  it('degrades to no proof when storage throws', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    });
    expect(() => savePendingEngagementProof('like:x')).not.toThrow();
    expect(readPendingEngagementProof()).toBeNull();
    expect(() => clearPendingEngagementProof()).not.toThrow();
  });
});

describe('decideResumeStep', () => {
  const base = {
    raw: serializePendingEngagement({ action: 'like', profileId }),
    pending: { action: 'like', profileId } as const,
    hasProof: true,
    isJoinEligible: false,
    canInteract: true,
    canEngage: true,
    stateUnknown: false,
    lookupFailed: false,
    isLiked: false,
    isFollowed: false,
  };

  it('does nothing without a pending action', () => {
    expect(decideResumeStep({ ...base, raw: null, pending: null })).toEqual({
      type: 'idle',
    });
  });

  it('clears a malformed pending action without announcing', () => {
    expect(decideResumeStep({ ...base, pending: null })).toEqual({
      type: 'clear',
    });
  });

  it('clears a crafted link that this browser never saved', () => {
    expect(decideResumeStep({ ...base, hasProof: false })).toEqual({
      type: 'clear',
    });
  });

  it('waits while the viewer is still join-eligible', () => {
    expect(decideResumeStep({ ...base, isJoinEligible: true })).toEqual({
      type: 'wait',
    });
  });

  it('waits while the relationship state is unknown', () => {
    expect(decideResumeStep({ ...base, stateUnknown: true })).toEqual({
      type: 'wait',
    });
  });

  it('fails instead of waiting once the relationship lookup has failed', () => {
    expect(
      decideResumeStep({ ...base, stateUnknown: true, lookupFailed: true }),
    ).toEqual({ type: 'fail' });
  });

  it('fails when the member cannot engage on this decision', () => {
    expect(decideResumeStep({ ...base, canEngage: false })).toEqual({
      type: 'fail',
    });
    expect(decideResumeStep({ ...base, canInteract: false })).toEqual({
      type: 'fail',
    });
  });

  it('applies a like that is not yet counted', () => {
    expect(decideResumeStep(base)).toEqual({
      type: 'apply',
      shouldWrite: true,
    });
  });

  it('announces without writing when the like already counts', () => {
    expect(decideResumeStep({ ...base, isLiked: true })).toEqual({
      type: 'apply',
      shouldWrite: false,
    });
  });

  it('applies a follow against the follow flag, not the like flag', () => {
    const follow = {
      ...base,
      raw: serializePendingEngagement({ action: 'follow', profileId }),
      pending: { action: 'follow', profileId } as const,
      isLiked: true,
    };
    expect(decideResumeStep(follow)).toEqual({
      type: 'apply',
      shouldWrite: true,
    });
    expect(decideResumeStep({ ...follow, isFollowed: true })).toEqual({
      type: 'apply',
      shouldWrite: false,
    });
  });
});
