import { db, eq } from '@op/db/client';
import { organizationRelationships } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const createAuthenticatedCaller = async (email: string) => {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
};

const createRelationship = async ({
  sourceOrganizationId,
  targetOrganizationId,
}: {
  sourceOrganizationId: string;
  targetOrganizationId: string;
}) => {
  const [row] = await db
    .insert(organizationRelationships)
    .values({
      sourceOrganizationId,
      targetOrganizationId,
      relationshipType: 'partnership',
      pending: true,
    })
    .returning();
  if (!row) {
    throw new Error('Failed to seed relationship');
  }
  return row;
};

const relationshipExists = async (id: string): Promise<boolean> => {
  const [row] = await db
    .select({ id: organizationRelationships.id })
    .from(organizationRelationships)
    .where(eq(organizationRelationships.id, id))
    .limit(1);
  return Boolean(row);
};

describe.concurrent('organization relationship authorization', () => {
  it('rejects removeRelationship from a user in neither org party to the relationship', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const [orgA, orgB, orgC] = await Promise.all([
      testData.createOrganization(),
      testData.createOrganization(),
      testData.createOrganization(),
    ]);

    const relationship = await createRelationship({
      sourceOrganizationId: orgA.organization.id,
      targetOrganizationId: orgB.organization.id,
    });

    const outsiderCaller = await createAuthenticatedCaller(
      orgC.adminUser.email,
    );

    await expect(
      outsiderCaller.organization.removeRelationship({ id: relationship.id }),
    ).rejects.toThrow(/not a member/i);

    expect(await relationshipExists(relationship.id)).toBe(true);
  });

  it('allows removeRelationship from a member of the source org', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const [orgA, orgB] = await Promise.all([
      testData.createOrganization(),
      testData.createOrganization(),
    ]);

    const relationship = await createRelationship({
      sourceOrganizationId: orgA.organization.id,
      targetOrganizationId: orgB.organization.id,
    });

    const sourceMemberCaller = await createAuthenticatedCaller(
      orgA.adminUser.email,
    );

    await sourceMemberCaller.organization.removeRelationship({
      id: relationship.id,
    });

    expect(await relationshipExists(relationship.id)).toBe(false);
  });

  it('allows removeRelationship from a member of the target org', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const [orgA, orgB] = await Promise.all([
      testData.createOrganization(),
      testData.createOrganization(),
    ]);

    const relationship = await createRelationship({
      sourceOrganizationId: orgA.organization.id,
      targetOrganizationId: orgB.organization.id,
    });

    const targetMemberCaller = await createAuthenticatedCaller(
      orgB.adminUser.email,
    );

    await targetMemberCaller.organization.removeRelationship({
      id: relationship.id,
    });

    expect(await relationshipExists(relationship.id)).toBe(false);
  });

  it('does not let declineRelationship delete relationships outside the authorized org', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const [orgA, orgB, orgC] = await Promise.all([
      testData.createOrganization(),
      testData.createOrganization(),
      testData.createOrganization(),
    ]);

    // Relationship between B and C — org A is not a party to it.
    const foreignRelationship = await createRelationship({
      sourceOrganizationId: orgB.organization.id,
      targetOrganizationId: orgC.organization.id,
    });

    // Caller is a member of org A and authorizes against org A,
    // but supplies ids belonging to the B→C relationship.
    const orgAMemberCaller = await createAuthenticatedCaller(
      orgA.adminUser.email,
    );

    await orgAMemberCaller.organization.declineRelationship({
      targetOrganizationId: orgA.organization.id,
      ids: [foreignRelationship.id],
    });

    expect(await relationshipExists(foreignRelationship.id)).toBe(true);
  });

  it('allows declineRelationship for relationships targeting the authorized org', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const [orgA, orgB] = await Promise.all([
      testData.createOrganization(),
      testData.createOrganization(),
    ]);

    const relationship = await createRelationship({
      sourceOrganizationId: orgB.organization.id,
      targetOrganizationId: orgA.organization.id,
    });

    const targetMemberCaller = await createAuthenticatedCaller(
      orgA.adminUser.email,
    );

    await targetMemberCaller.organization.declineRelationship({
      targetOrganizationId: orgA.organization.id,
      ids: [relationship.id],
    });

    expect(await relationshipExists(relationship.id)).toBe(false);
  });
});
