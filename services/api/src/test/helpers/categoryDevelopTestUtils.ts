import type { DecisionSchemaDefinition } from '@op/common';
import {
  type TestDecisionsDataManager,
  createCategoryReviewer,
  grantInstanceReviewerRole,
  testMinimalSchema,
} from '@op/common/testing';
import { db } from '@op/db/client';
import { ProcessStatus } from '@op/db/schema';

import { seedTwoCategories } from './categoryTestUtils';

type OnTestFinished = (fn: () => void | Promise<void>) => void;

/** `testMinimalSchema` with a develop rule on the final phase. */
const developSchema = {
  ...testMinimalSchema,
  id: 'test-category-develop-schema',
  name: 'Test Category Develop Schema',
  phases: [
    testMinimalSchema.phases[0],
    {
      ...testMinimalSchema.phases[1],
      rules: {
        ...testMinimalSchema.phases[1].rules,
        proposals: { submit: false, develop: true },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

/**
 * A published instance with two category terms. Unless `advance` is false, it
 * is in its develop phase ("final"); otherwise it stays in "initial".
 */
export async function createCategoryDevelopSetup({
  testData,
  onTestFinished,
  advance = true,
}: {
  testData: TestDecisionsDataManager;
  onTestFinished: OnTestFinished;
  advance?: boolean;
}) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    processSchema: developSchema,
    status: ProcessStatus.PUBLISHED,
  });
  const instanceId = setup.instance.instance.id;
  const { terms } = await seedTwoCategories(onTestFinished);
  const [termA, termB] = terms;
  if (!termA || !termB) {
    throw new Error('Expected two category terms');
  }

  if (advance) {
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'initial',
      toPhaseId: 'final',
    });
  }

  return { setup, instanceId, termA, termB };
}

/**
 * A member with Review on the instance and a category reviewer row for each
 * entry of `rows`.
 */
export async function createCategoryDevelopReviewer({
  testData,
  setup,
  rows,
}: {
  testData: TestDecisionsDataManager;
  setup: Awaited<ReturnType<typeof createCategoryDevelopSetup>>['setup'];
  rows: { taxonomyTermId: string; phaseId: string | null }[];
}) {
  const member = await testData.createMemberUser({
    organization: setup.organization,
  });
  await grantInstanceReviewerRole({
    instanceProfileId: setup.instance.profileId,
    authUserId: member.authUserId,
    email: member.email,
    roleName: `Reviewer ${member.authUserId}`,
  });
  const rowIds = await Promise.all(
    rows.map(async ({ taxonomyTermId, phaseId }) => {
      const row = await createCategoryReviewer({
        processInstanceId: setup.instance.instance.id,
        taxonomyTermId,
        reviewerProfileId: member.profileId,
        phaseId,
      });
      return row.id;
    }),
  );

  return { ...member, rowIds };
}

/** The stored `data` of each category reviewer row, by row id. */
export async function getCategoryReviewerData(
  rowIds: string[],
): Promise<Map<string, unknown>> {
  const rows = await db.query.categoryReviewers.findMany({
    where: { id: { in: rowIds } },
    columns: { id: true, data: true },
  });

  return new Map(rows.map((row) => [row.id, row.data]));
}
