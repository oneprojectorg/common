import { db } from '@op/db/client';
import { eventOutbox } from '@op/db/schema';
import { Events } from '@op/events';
import { inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, onTestFinished } from 'vitest';

import type { OutboxEvent } from './buildOutboxEvent';
import { relayOutboxEvents } from './relayOutboxEvents';
import { writeOutboxEvent } from './writeOutboxEvent';

const seedRow = async () => {
  const row = await writeOutboxEvent({
    eventName: Events.proposalCommentPosted.name,
    payload: {
      postId: randomUUID(),
      proposalId: randomUUID(),
      authorProfileId: randomUUID(),
    },
  });
  onTestFinished(async () => {
    await db.delete(eventOutbox).where(inArray(eventOutbox.id, [row.id]));
  });
  return row;
};

const readRow = async (id: string) => {
  const rows = await db
    .select()
    .from(eventOutbox)
    .where(inArray(eventOutbox.id, [id]));
  return rows[0]!;
};

describe('relayOutboxEvents', () => {
  it('sends an unsent row once, with the row id as the event id', async () => {
    const row = await seedRow();
    const sends: OutboxEvent[] = [];

    const first = await relayOutboxEvents({
      ids: [row.id],
      send: async (event) => {
        sends.push(event);
      },
    });
    const second = await relayOutboxEvents({
      ids: [row.id],
      send: async (event) => {
        sends.push(event);
      },
    });

    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(sends).toHaveLength(1);
    expect(sends[0]!.id).toBe(row.id);
    expect(sends[0]!.name).toBe(Events.proposalCommentPosted.name);
    expect(sends[0]!.data).toEqual(row.payload);

    const after = await readRow(row.id);
    expect(after.sentAt).not.toBeNull();
    expect(after.attempts).toBe(1);
  });

  it('keeps a failed row unsent and bumps attempts', async () => {
    const row = await seedRow();

    const result = await relayOutboxEvents({
      ids: [row.id],
      send: async () => {
        throw new Error('inngest is down');
      },
    });

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
    const after = await readRow(row.id);
    expect(after.sentAt).toBeNull();
    expect(after.attempts).toBe(1);
  });
});
