import { TestDecisionsDataManager } from '@op/common/testing';
import { ProcessStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { listSmsDecisions } from './listSmsDecisions';

describe.concurrent('listSmsDecisions', () => {
  it('given a member of a published decision, then it is listed by name and slug with voting closed in its first phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
    });

    await expect(
      listSmsDecisions({ authUserId: setup.user.id }),
    ).resolves.toEqual([
      {
        name: setup.instance.instance.name,
        slug: setup.instance.slug,
        votingOpen: false,
      },
    ]);
  });

  it('given a public decision the user never joined, then it is not in their list', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    await testData.makeDecisionPublic(setup.instance.profileId);
    const outsider = await testData.createMemberUser({
      organization: setup.organization,
    });

    const listed = await listSmsDecisions({ authUserId: outsider.authUserId });

    expect(listed.map((decision) => decision.slug)).not.toContain(
      setup.instance.slug,
    );
  });
});
