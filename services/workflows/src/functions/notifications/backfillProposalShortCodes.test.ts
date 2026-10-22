import { parsePhoneNumber } from '@op/common';
import { db, eq, sql } from '@op/db/client';
import { proposals } from '@op/db/schema';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { SmsCommandFixture } from '../../../testing/smsCommandFixture';

const NUMBERS = {
  owner: '+15005550083',
} as const;

const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

const MINUTE_MS = 60_000;

const runBackfill = (args: string) =>
  execSync(`pnpm --filter @op/db backfill:proposal-short-codes -- ${args}`, {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    encoding: 'utf8',
  });

describe('backfill-proposal-short-codes against the database', () => {
  it('given a published decision whose proposals were inserted out of creation order, when the script runs, then codes follow creation time, the counter moves past them, and a second run assigns nothing', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const owner = await fixture.createPhoneOnlyAccount(
      parsePhoneNumber(NUMBERS.owner),
    );
    const base = Date.now();
    const { instanceProfileId } = await fixture.createVotingInstance({
      owner,
      name: `Backfill ${task.id}`,
      proposalTitles: [
        { title: 'Created last', createdAt: new Date(base + 2 * MINUTE_MS) },
        { title: 'Created first', createdAt: new Date(base - 2 * MINUTE_MS) },
        { title: 'Created second', createdAt: new Date(base - MINUTE_MS) },
      ],
    });
    const instance = await db.query.processInstances.findFirst({
      where: { profileId: instanceProfileId },
      columns: { id: true },
    });
    if (!instance) {
      throw new Error('The fixture created no process instance');
    }

    const dryRun = runBackfill(`--dry-run --instance=${instance.id}`);
    runBackfill(`--instance=${instance.id}`);
    const secondDryRun = runBackfill(`--dry-run --instance=${instance.id}`);

    const rows = await db
      .select({
        title: sql<string>`${proposals.proposalData}->>'title'`,
        code: proposals.shortCode,
      })
      .from(proposals)
      .where(eq(proposals.processInstanceId, instance.id))
      .orderBy(proposals.shortCode);
    const counter = await db.query.processInstances.findFirst({
      where: { id: instance.id },
      columns: { nextShortCode: true },
    });

    expect(rows).toEqual([
      { title: 'Created first', code: 101 },
      { title: 'Created second', code: 102 },
      { title: 'Created last', code: 103 },
    ]);
    expect(counter).toEqual({ nextShortCode: 104 });
    expect(dryRun).toContain('3 assigned  101..103');
    expect(secondDryRun).toContain('0 assigned');
  });
});
