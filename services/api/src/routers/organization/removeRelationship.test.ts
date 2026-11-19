import { TestOrganizationDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { organizationRelationships } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { createAuthenticatedCaller } from '../../test/supabase-utils';

describeAccessTierGating('organization.removeRelationship', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.organization.removeRelationship({
        id: '00000000-0000-0000-0000-000000000000',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.organization.removeRelationship({
          id: '00000000-0000-0000-0000-000000000000',
        }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.organization.removeRelationship({
          id: '00000000-0000-0000-0000-000000000000',
        }),
        'user',
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.organization.removeRelationship({
          id: '00000000-0000-0000-0000-000000000000',
        }),
      );
    },
  ),
});

describe.concurrent('organization.removeRelationship authorization', () => {
  const createRelationship = async ({
    data,
    onTestFinished,
  }: {
    data: TestOrganizationDataManager;
    onTestFinished: (fn: () => Promise<void>) => void;
  }) => {
    const source = await data.createOrganization({ users: { admin: 1 } });
    const target = await data.createOrganization({ users: { admin: 1 } });

    const [relationship] = await db
      .insert(organizationRelationships)
      .values({
        sourceOrganizationId: source.organization.id,
        targetOrganizationId: target.organization.id,
        relationshipType: 'partnership',
        pending: true,
      })
      .returning();

    if (!relationship) {
      throw new Error('Failed to create relationship');
    }

    onTestFinished(async () => {
      await db
        .delete(organizationRelationships)
        .where(eq(organizationRelationships.id, relationship.id));
    });

    return { source, target, relationship };
  };

  const findRelationship = (id: string) =>
    db.query.organizationRelationships.findFirst({ where: { id } });

  it('rejects a caller who is not a member of either organization', async ({
    task,
    onTestFinished,
  }) => {
    const data = new TestOrganizationDataManager(task.id, onTestFinished);
    const { relationship } = await createRelationship({ data, onTestFinished });
    const outsider = await data.createOrganization({ users: { admin: 1 } });
    const caller = await createAuthenticatedCaller(outsider.adminUser.email);

    await expect(
      caller.organization.removeRelationship({ id: relationship.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(await findRelationship(relationship.id)).toBeDefined();
  });

  it('rejects an unknown relationship id', async ({ task, onTestFinished }) => {
    const data = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await data.createOrganization({
      users: { admin: 1 },
    });
    const caller = await createAuthenticatedCaller(adminUser.email);

    await expect(
      caller.organization.removeRelationship({ id: randomUUID() }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it.for(['source', 'target'] as const)(
    'lets a member of the %s organization remove it',
    async (side, { task, onTestFinished }) => {
      const data = new TestOrganizationDataManager(task.id, onTestFinished);
      const created = await createRelationship({ data, onTestFinished });
      const caller = await createAuthenticatedCaller(
        created[side].adminUser.email,
      );

      await caller.organization.removeRelationship({
        id: created.relationship.id,
      });

      expect(await findRelationship(created.relationship.id)).toBeUndefined();
    },
  );
});
