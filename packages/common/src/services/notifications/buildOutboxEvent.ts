import { Events } from '@op/events';

import { CommonError } from '../../utils';

export interface OutboxRowInput {
  id: string;
  eventName: string;
  payload: unknown;
}

export const buildOutboxEvent = (row: OutboxRowInput) => {
  switch (row.eventName) {
    case Events.proposalCommentPosted.name:
      return {
        id: row.id,
        name: Events.proposalCommentPosted.name,
        data: Events.proposalCommentPosted.schema.parse(row.payload),
      };
    default:
      throw new CommonError(`Unknown outbox event: ${row.eventName}`);
  }
};

export type OutboxEvent = ReturnType<typeof buildOutboxEvent>;
