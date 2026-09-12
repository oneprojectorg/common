import type { ChannelName } from '@op/common/realtime';
import { describe, expect, it } from 'vitest';

import { ChannelInvalidationDedup } from './channelInvalidationDedup';

const channel = (name: string) => name as ChannelName;

describe('ChannelInvalidationDedup', () => {
  it('takes each channel of a mutation once', () => {
    const dedup = new ChannelInvalidationDedup();
    const channels = [channel('decisionProposal:i1:p1')];

    expect(dedup.take('m1', channels)).toEqual(channels);
    expect(dedup.take('m1', channels)).toEqual([]);
  });

  it("still takes a mutation's other channels after one of them arrives", () => {
    const dedup = new ChannelInvalidationDedup();
    const assignment = channel('reviewAssignment:a1');
    const proposal = channel('decisionProposal:i1:p1');

    // A fan-out is published once per channel, all messages sharing the id: the
    // first arrival must not swallow the rest.
    expect(dedup.take('m1', [assignment])).toEqual([assignment]);
    expect(dedup.take('m1', [proposal])).toEqual([proposal]);
  });

  it('takes only the channels a mutation has not been seen on', () => {
    const dedup = new ChannelInvalidationDedup();
    const assignment = channel('reviewAssignment:a1');
    const proposal = channel('decisionProposal:i1:p1');

    dedup.take('m1', [assignment]);

    expect(dedup.take('m1', [assignment, proposal])).toEqual([proposal]);
  });

  it('keeps the same channel separate per mutation', () => {
    const dedup = new ChannelInvalidationDedup();
    const channels = [channel('decisionProposal:i1:p1')];

    expect(dedup.take('m1', channels)).toEqual(channels);
    expect(dedup.take('m2', channels)).toEqual(channels);
  });

  it('forgets the oldest keys once the bound is passed', () => {
    const dedup = new ChannelInvalidationDedup();
    const first = channel('decisionProposal:i1:p0');

    dedup.take('m0', [first]);
    for (let i = 1; i <= 500; i++) {
      dedup.take(`m${i}`, [channel(`decisionProposal:i1:p${i}`)]);
    }

    // Evicted, so it is takeable again — bounded memory, not permanent dedup.
    expect(dedup.take('m0', [first])).toEqual([first]);
  });
});
