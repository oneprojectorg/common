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

const entrySchema = {
  type: 'object',
  required: ['title', 'ballotDescription'],
  'x-field-order': ['title', 'ballotDescription'],
  properties: {
    title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
    ballotDescription: {
      type: 'string',
      title: 'Ballot description',
      maxLength: 280,
      'x-format': 'long-text',
    },
  },
};

describe.concurrent('createFormSchema', () => {
  it('given an instance admin, when they create a form schema, then the row is returned with its hash and author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const row = await caller.decision.createFormSchema({
      processInstanceId: setup.instance.instance.id,
      name: 'Ballot entry',
      schema: entrySchema,
    });

    expect(row.processInstanceId).toBe(setup.instance.instance.id);
    expect(row.name).toBe('Ballot entry');
    expect(row.schema).toEqual(entrySchema);
    expect(row.schemaHash).not.toBeNull();
    expect(row.createdByProfileId).not.toBeNull();
    expect(row.parentId).toBeNull();
  });

  it('given a non-admin member of the instance, when they create a form schema, then they are refused', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.createFormSchema({
        processInstanceId: setup.instance.instance.id,
        name: 'Ballot entry',
        schema: entrySchema,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('given a parent row of another instance, when a new version names it as parent, then it is not found', async ({
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

    const otherInstanceRow = await caller.decision.createFormSchema({
      processInstanceId: second.instance.id,
      name: 'Ballot entry',
      schema: entrySchema,
    });

    await expect(
      caller.decision.createFormSchema({
        processInstanceId: first.instance.id,
        name: 'Ballot entry v2',
        schema: entrySchema,
        parentId: otherInstanceRow.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('given a stored row, when the same content is stored again for the same instance and parent, then it is refused', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);
    const processInstanceId = setup.instance.instance.id;

    await caller.decision.createFormSchema({
      processInstanceId,
      name: 'Ballot entry',
      schema: entrySchema,
    });

    await expect(
      caller.decision.createFormSchema({
        processInstanceId,
        name: 'Another name',
        schema: entrySchema,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('given a stored row, when the same content is stored as its child, then the child is created with the parent id', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);
    const processInstanceId = setup.instance.instance.id;

    const parent = await caller.decision.createFormSchema({
      processInstanceId,
      name: 'Ballot entry',
      schema: entrySchema,
    });

    const child = await caller.decision.createFormSchema({
      processInstanceId,
      name: 'Ballot entry',
      schema: entrySchema,
      parentId: parent.id,
    });

    expect(child.id).not.toBe(parent.id);
    expect(child.parentId).toBe(parent.id);
    expect(child.schemaHash).toBe(parent.schemaHash);
  });
});
