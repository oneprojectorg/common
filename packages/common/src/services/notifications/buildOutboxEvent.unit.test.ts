import { Events } from '@op/events';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { buildOutboxEvent } from './buildOutboxEvent';

describe('buildOutboxEvent', () => {
  it('builds a typed Inngest event from a proposalComment row', () => {
    const id = randomUUID();
    const payload = {
      postId: randomUUID(),
      proposalId: randomUUID(),
      authorProfileId: randomUUID(),
    };

    const event = buildOutboxEvent({
      id,
      eventName: Events.proposalCommentPosted.name,
      payload,
    });

    expect(event).toEqual({
      id,
      name: Events.proposalCommentPosted.name,
      data: payload,
    });
  });

  it('throws on an event name the relay does not know', () => {
    expect(() =>
      buildOutboxEvent({
        id: randomUUID(),
        eventName: 'unknown/event',
        payload: {},
      }),
    ).toThrow(/unknown\/event/);
  });

  it('throws on a payload that fails the event schema', () => {
    expect(() =>
      buildOutboxEvent({
        id: randomUUID(),
        eventName: Events.proposalCommentPosted.name,
        payload: { postId: 'not-a-uuid' },
      }),
    ).toThrow();
  });
});
