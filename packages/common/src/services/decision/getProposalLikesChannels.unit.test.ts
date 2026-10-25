import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getProposalLikesChannels } from './getProposalLikesChannels';

const INSTANCE_ID = 'instance-1';
const PROFILE_ID = 'profile-1';

describe('getProposalLikesChannels', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE', 'test-service-role');
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

  it('registers nothing without a key to derive the name from', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE', '');

    expect(
      getProposalLikesChannels({
        processInstanceId: INSTANCE_ID,
        profileId: PROFILE_ID,
      }),
    ).toEqual([]);
  });
});
