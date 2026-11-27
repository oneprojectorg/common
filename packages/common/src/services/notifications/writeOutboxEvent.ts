import { type DbClient, db as defaultDb } from '@op/db/client';
import { eventOutbox } from '@op/db/schema';
import { Events } from '@op/events';
import type { z } from 'zod';

import { CommonError } from '../../utils';

type EventDefs = typeof Events;

export type OutboxPayloadByName = {
  [K in keyof EventDefs as EventDefs[K]['name']]: z.infer<
    EventDefs[K]['schema']
  >;
};

export interface WriteOutboxEventInput<N extends keyof OutboxPayloadByName> {
  eventName: N;
  payload: OutboxPayloadByName[N];
  db?: DbClient;
}

export const writeOutboxEvent = async <N extends keyof OutboxPayloadByName>({
  eventName,
  payload,
  db = defaultDb,
}: WriteOutboxEventInput<N>) => {
  const [row] = await db
    .insert(eventOutbox)
    .values({ eventName, payload })
    .returning();

  if (!row) {
    throw new CommonError('Failed to write outbox event');
  }

  return row;
};
