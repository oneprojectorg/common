import { TestOrganizationDataManager } from '@op/common/testing';
import { db, inArray } from '@op/db/client';
import { organizationRelationships } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { createAuthenticatedCaller } from '../../test/supabase-utils';

describeAccessTierGating('organization.listPendingRelationships', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.organization.listPendingRelationships(),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.organization.listPendingRelationships(),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.organization.listPendingRelationships(),
        'user',
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.organization.listPendingRelationships(),
      );
    },
  ),
});

describeAccessTierGating('organization.listDirectedRelationships', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.organization.listDirectedRelationships({
        from: '00000000-0000-0000-0000-000000000000',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.organization.listDirectedRelationships({
          from: '00000000-0000-0000-0000-000000000000',
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
        caller.organization.listDirectedRelationships({
          from: '00000000-0000-0000-0000-000000000000',
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
        caller.organization.listDirectedRelationships({
          from: '00000000-0000-0000-0000-000000000000',
        }),
      );
    },
  ),
});

describeAccessTierGating('organization.listRelationships', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.organization.listRelationships({
        organizationId: '00000000-0000-0000-0000-000000000000',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.organization.listRelationships({
          organizationId: '00000000-0000-0000-0000-000000000000',
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
        caller.organization.listRelationships({
          organizationId: '00000000-0000-0000-0000-000000000000',
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
        caller.organization.listRelationships({
          organizationId: '00000000-0000-0000-0000-000000000000',
        }),
      );
    },
  ),
});

describe.concurrent('organization.listRelationships', () => {
  it('groups relationships in both directions by related organization', async ({
    task,
    onTestFinished,
  }) => {
    const data = new TestOrganizationDataManager(task.id, onTestFinished);
    const subject = await data.createOrganization({ users: { admin: 1 } });
    const partner = await data.createOrganization({ users: { admin: 1 } });
    const funder = await data.createOrganization({ users: { admin: 1 } });

    const inserted = await db
      .insert(organizationRelationships)
      .values([
        {
          sourceOrganizationId: subject.organization.id,
          targetOrganizationId: partner.organization.id,
          relationshipType: 'partnership',
          pending: false,
        },
        {
          sourceOrganizationId: subject.organization.id,
          targetOrganizationId: partner.organization.id,
          relationshipType: 'memberOf',
          pending: true,
        },
        {
          sourceOrganizationId: funder.organization.id,
          targetOrganizationId: subject.organization.id,
          relationshipType: 'funding',
          pending: false,
        },
      ])
      .returning();
    onTestFinished(async () => {
      await db.delete(organizationRelationships).where(
        inArray(
          organizationRelationships.id,
          inserted.map((relationship) => relationship.id),
        ),
      );
    });

    const caller = await createAuthenticatedCaller(subject.adminUser.email);
    const { organizations, count } =
      await caller.organization.listRelationships({
        organizationId: subject.organization.id,
      });

    expect(count).toBe(2);
    const byId = new Map(organizations.map((org) => [org.id, org]));
    expect(
      byId
        .get(partner.organization.id)
        ?.relationships?.map((relationship) => relationship.relationshipType)
        .sort(),
    ).toEqual(['hasMember', 'partnership']);
    expect(
      byId
        .get(funder.organization.id)
        ?.relationships?.map((relationship) => relationship.relationshipType),
    ).toEqual(['funding']);
  });
});
