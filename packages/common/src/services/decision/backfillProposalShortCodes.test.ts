import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq, sql } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  profiles,
  proposals,
} from '@op/db/schema';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

const MINUTE_MS = 60_000;

const runBackfill = (args: string) =>
  execSync(`pnpm --filter @op/db backfill:proposal-short-codes -- ${args}`, {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    encoding: 'utf8',
  });

describe.concurrent('backfill-proposal-short-codes against the database', () => {
  it('given a published decision whose proposals were inserted out of creation order, when the script runs, then each submitted proposal profile gets a code in creation order scoped to the decision profile, a draft gets none, the decision counter moves past them, and a second run assigns nothing', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
      grantAccess: true,
    });
    const { instance, profileId: decisionProfileId } = setup.instance;
    const creator = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [decisionProfileId],
    });
    const base = Date.now();
    const seed = (
      title: string,
      offsetMinutes: number,
      status: ProposalStatus,
    ) =>
      testData.createProposal({
        userEmail: creator.email,
        processInstanceId: instance.id,
        proposalData: { title },
        status,
        createdAt: new Date(base + offsetMinutes * MINUTE_MS),
      });
    await seed('Created last', 2, ProposalStatus.SUBMITTED);
    await seed('Created first', -2, ProposalStatus.SUBMITTED);
    await seed('Created second', -1, ProposalStatus.SUBMITTED);
    await seed('Still a draft', -3, ProposalStatus.DRAFT);

    const dryRun = runBackfill(`--dry-run --instance=${instance.id}`);
    runBackfill(`--instance=${instance.id}`);
    const secondDryRun = runBackfill(`--dry-run --instance=${instance.id}`);

    const rows = await db
      .select({
        title: sql<string>`${proposals.proposalData}->>'title'`,
        code: profiles.shortCode,
        scope: profiles.shortCodeScopeId,
      })
      .from(proposals)
      .innerJoin(profiles, eq(profiles.id, proposals.profileId))
      .where(eq(proposals.processInstanceId, instance.id))
      .orderBy(profiles.shortCode);
    const counter = await db.query.profiles.findFirst({
      where: { id: decisionProfileId },
      columns: { nextShortCode: true },
    });

    expect(rows).toEqual([
      { title: 'Created first', code: 101, scope: decisionProfileId },
      { title: 'Created second', code: 102, scope: decisionProfileId },
      { title: 'Created last', code: 103, scope: decisionProfileId },
      { title: 'Still a draft', code: null, scope: null },
    ]);
    expect(counter).toEqual({ nextShortCode: 104 });
    expect(dryRun).toContain('3 assigned  101..103');
    expect(secondDryRun).toContain('0 assigned');
  });
});
