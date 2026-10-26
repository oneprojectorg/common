import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getProposalLikesChannels } from './getProposalLikesChannels';

const INSTANCE_ID = 'instance-1';
const PROFILE_ID = 'profile-1';

describe('getProposalLikesChannels', () => {
  beforeEach(() => {
    vi.stubEnv('REALTIME_CHANNEL_SECRET', 'test-channel-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('names the channel without the liker, so nobody else can derive it', () => {
    const [channel] = getProposalLikesChannels({
      processInstanceId: INSTANCE_ID,
      profileId: PROFILE_ID,
    });

    expect(channel).toMatch(/^decisionProposalLikes:instance-1:[0-9a-f]{32}$/);
    expect(channel).not.toContain(PROFILE_ID);
  });

  it('gives the list and the like the same name for the same liker', () => {
    const args = { processInstanceId: INSTANCE_ID, profileId: PROFILE_ID };

    expect(getProposalLikesChannels(args)).toEqual(
      getProposalLikesChannels(args),
    );
  });

  it('gives each liker and each instance its own channel', () => {
    const [base] = getProposalLikesChannels({
      processInstanceId: INSTANCE_ID,
      profileId: PROFILE_ID,
    });
    const [otherLiker] = getProposalLikesChannels({
      processInstanceId: INSTANCE_ID,
      profileId: 'profile-2',
    });
    const [otherInstance] = getProposalLikesChannels({
      processInstanceId: 'instance-2',
      profileId: PROFILE_ID,
    });

    expect(otherLiker).not.toBe(base);
    expect(otherInstance).not.toBe(base);
  });

  it('derives the name from the key, so a different key gives a different one', () => {
    const args = { processInstanceId: INSTANCE_ID, profileId: PROFILE_ID };
    const [withTestKey] = getProposalLikesChannels(args);

    vi.stubEnv('REALTIME_CHANNEL_SECRET', 'another-secret');

    expect(getProposalLikesChannels(args)).not.toEqual([withTestKey]);
  });

  it('registers nothing without a liker', () => {
    expect(
      getProposalLikesChannels({
        processInstanceId: INSTANCE_ID,
        profileId: undefined,
      }),
    ).toEqual([]);
  });

  it('registers nothing without a key to derive the name from', () => {
    vi.stubEnv('REALTIME_CHANNEL_SECRET', '');

    expect(
      getProposalLikesChannels({
        processInstanceId: INSTANCE_ID,
        profileId: PROFILE_ID,
      }),
    ).toEqual([]);
  });
});
