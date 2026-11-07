import { TestDecisionsDataManager } from '@op/common/testing';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

function entrySchema(maxLength: number) {
  return {
    type: 'object',
    required: ['title', 'ballotDescription'],
    'x-field-order': ['title', 'ballotDescription'],
    properties: {
      title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
      ballotDescription: {
        type: 'string',
        title: 'Ballot description',
        maxLength,
        'x-format': 'long-text',
      },
    },
  };
}

describe.concurrent('listFormSchemas and getFormSchema', () => {
  it("given two rows in an instance and one in another, when the instance's rows are listed, then only its own come back oldest first", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
    });
    const [first, second] = setup.instances;
    if (!first || !second) {
      throw new Error('Expected two instances');
    }
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const older = await caller.decision.createFormSchema({
      processInstanceId: first.instance.id,
      name: 'Ballot entry',
      schema: entrySchema(280),
    });
    const newer = await caller.decision.createFormSchema({
      processInstanceId: first.instance.id,
      name: 'Ballot entry',
      schema: entrySchema(140),
      parentId: older.id,
    });
    const otherInstanceRow = await caller.decision.createFormSchema({
      processInstanceId: second.instance.id,
      name: 'Ballot entry',
      schema: entrySchema(280),
    });

    const result = await caller.decision.listFormSchemas({
      processInstanceId: first.instance.id,
    });

    expect(result.items.length).toBe(2);
    expect(result.items.map((row) => row.id)).toEqual([older.id, newer.id]);
    expect(result.items.map((row) => row.id)).not.toContain(
      otherInstanceRow.id,
    );
  });

  it('given a stored row, when an admin of its instance gets it, then the row comes back', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const created = await caller.decision.createFormSchema({
      processInstanceId: setup.instance.instance.id,
      name: 'Ballot entry',
      schema: entrySchema(280),
    });

    const fetched = await caller.decision.getFormSchema({
      formSchemaId: created.id,
    });

    expect(fetched).toEqual(created);
  });

  it("given a member of one instance, when they get another instance's row, then they are refused", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const [setup, otherSetup] = await Promise.all([
      testData.createDecisionSetup({ instanceCount: 1, grantAccess: true }),
      testData.createDecisionSetup({ instanceCount: 1, grantAccess: true }),
    ]);
    const otherCaller = await createAuthenticatedCaller(otherSetup.userEmail);

    const otherInstanceRow = await otherCaller.decision.createFormSchema({
      processInstanceId: otherSetup.instance.instance.id,
      name: 'Ballot entry',
      schema: entrySchema(280),
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.getFormSchema({
        formSchemaId: otherInstanceRow.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});
