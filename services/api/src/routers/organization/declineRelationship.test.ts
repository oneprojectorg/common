import { TestOrganizationDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { organizationRelationships } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { createAuthenticatedCaller } from '../../test/supabase-utils';

describeAccessTierGating('organization.declineRelationship', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.organization.declineRelationship({
        targetOrganizationId: '00000000-0000-0000-0000-000000000000',
        ids: [],
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.organization.declineRelationship({
          targetOrganizationId: '00000000-0000-0000-0000-000000000000',
          ids: [],
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
        caller.organization.declineRelationship({
          targetOrganizationId: '00000000-0000-0000-0000-000000000000',
          ids: [],
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
        caller.organization.declineRelationship({
          targetOrganizationId: '00000000-0000-0000-0000-000000000000',
          ids: [],
        }),
      );
    },
  ),
});

describe.concurrent('organization.declineRelationship authorization', () => {
  const createPendingRequest = async ({
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

    return { target, relationship };
  };

  const findRelationship = (id: string) =>
    db.query.organizationRelationships.findFirst({ where: { id } });

  it('does not decline a request sent to another organization', async ({
    task,
    onTestFinished,
  }) => {
    const data = new TestOrganizationDataManager(task.id, onTestFinished);
    const { relationship } = await createPendingRequest({
      data,
      onTestFinished,
    });
    const outsider = await data.createOrganization({ users: { admin: 1 } });
    const caller = await createAuthenticatedCaller(outsider.adminUser.email);

    await caller.organization.declineRelationship({
      targetOrganizationId: outsider.organization.id,
      ids: [relationship.id],
    });

    expect(await findRelationship(relationship.id)).toBeDefined();
  });

  it('lets a member of the target organization decline a request', async ({
    task,
    onTestFinished,
  }) => {
    const data = new TestOrganizationDataManager(task.id, onTestFinished);
    const { target, relationship } = await createPendingRequest({
      data,
      onTestFinished,
    });
    const caller = await createAuthenticatedCaller(target.adminUser.email);

    await caller.organization.declineRelationship({
      targetOrganizationId: target.organization.id,
      ids: [relationship.id],
    });

    expect(await findRelationship(relationship.id)).toBeUndefined();
  });
});
