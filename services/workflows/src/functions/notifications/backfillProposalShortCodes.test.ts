import { parsePhoneNumber } from '@op/common';
import { db, eq } from '@op/db/client';
import { proposals } from '@op/db/schema';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { SmsCommandFixture } from '../../../testing/smsCommandFixture';

const NUMBERS = {
  owner: '+15005550083',
} as const;

const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

const runBackfill = (args: string) =>
  execSync(`pnpm --filter @op/db backfill:proposal-short-codes -- ${args}`, {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    encoding: 'utf8',
  });

describe('backfill-proposal-short-codes against the database', () => {
  it('given a published decision with three uncoded proposals, when the script runs, then they get 101, 102 and 103 in creation order and a second run assigns nothing', async ({
    task,
    onTestFinished,
  }) => {
    const fixture = new SmsCommandFixture(task.id, onTestFinished);
    const owner = await fixture.createPhoneOnlyAccount(
      parsePhoneNumber(NUMBERS.owner),
    );
    const { instanceProfileId } = await fixture.createVotingInstance({
      owner,
      name: `Backfill ${task.id}`,
      proposalTitles: ['First', 'Second', 'Third'],
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
      .select({ code: proposals.shortCode })
      .from(proposals)
      .where(eq(proposals.processInstanceId, instance.id))
      .orderBy(proposals.shortCode);

    expect(rows.map((row) => row.code)).toEqual([101, 102, 103]);
    expect(dryRun).toContain('3 assigned  101..103');
    expect(secondDryRun).toContain('0 assigned');
  });
});
