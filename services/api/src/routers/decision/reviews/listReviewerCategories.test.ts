import { db, inArray } from '@op/db/client';
import { categoryReviewers, taxonomyTerms } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
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

/** Inserts taxonomy terms; deleting them on cleanup cascade-deletes the scope rows. */
async function seedCategoryTerms(
  labels: string[],
  onTestFinished: (fn: () => void | Promise<void>) => void,
) {
  const records = labels.map((label) => ({
    id: randomUUID(),
    termUri: `${label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-${randomUUID().slice(0, 8)}`,
    label,
  }));

  await db.insert(taxonomyTerms).values(records);

  onTestFinished(async () => {
    await db.delete(taxonomyTerms).where(
      inArray(
        taxonomyTerms.id,
        records.map((t) => t.id),
      ),
    );
  });

  return records;
}

describe.concurrent('listReviewerCategories', () => {
  it('returns the reviewer’s categories ordered by label', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const instanceId = context.instance.instance.id;
    const reviewer = await testData.createInstanceReviewerWithRole(context);

    const suffix = randomUUID().slice(0, 8);
    // B-before-A so result order can only come from the SQL ORDER BY
    const [termB, termA] = await seedCategoryTerms(
      [`District ${suffix} B`, `District ${suffix} A`],
      onTestFinished,
    );

    await db.insert(categoryReviewers).values([
      {
        processInstanceId: instanceId,
        taxonomyTermId: termB!.id,
        reviewerProfileId: reviewer.profileId,
      },
      {
        processInstanceId: instanceId,
        taxonomyTermId: termA!.id,
        reviewerProfileId: reviewer.profileId,
      },
    ]);

    const caller = await createAuthenticatedCaller(reviewer.email);
    const result = await caller.decision.listReviewerCategories({
      processInstanceId: instanceId,
      phaseId: 'review',
    });

    expect(result).toEqual([
      { id: termA!.id, name: termA!.label },
      { id: termB!.id, name: termB!.label },
    ]);
  });

  it('returns an empty list for a reviewer with no scope rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const reviewer = await testData.createInstanceReviewerWithRole(context);

    const caller = await createAuthenticatedCaller(reviewer.email);
    const result = await caller.decision.listReviewerCategories({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result).toEqual([]);
  });

  it('does not return another reviewer’s scope rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const instanceId = context.instance.instance.id;
    const reviewer = await testData.createInstanceReviewerWithRole(context);
    const otherReviewer = await testData.createReviewer(context);

    const suffix = randomUUID().slice(0, 8);
    const [ownTerm, otherTerm] = await seedCategoryTerms(
      [`District ${suffix} Own`, `District ${suffix} Other`],
      onTestFinished,
    );

    await db.insert(categoryReviewers).values([
      {
        processInstanceId: instanceId,
        taxonomyTermId: ownTerm!.id,
        reviewerProfileId: reviewer.profileId,
      },
      {
        processInstanceId: instanceId,
        taxonomyTermId: otherTerm!.id,
        reviewerProfileId: otherReviewer.profileId,
      },
    ]);

    const caller = await createAuthenticatedCaller(reviewer.email);
    const result = await caller.decision.listReviewerCategories({
      processInstanceId: instanceId,
      phaseId: 'review',
    });

    expect(result).toEqual([{ id: ownTerm!.id, name: ownTerm!.label }]);
  });

  it('rejects callers without review access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    // READ on the instance profile, but no REVIEW and no ADMIN.
    const member = await testData.createInstanceMember(context);

    const caller = await createAuthenticatedCaller(member.email);

    await expect(
      caller.decision.listReviewerCategories({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('matches instance-wide (phaseId NULL) rows alongside the requested phase, deduplicated', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const instanceId = context.instance.instance.id;
    const reviewer = await testData.createInstanceReviewerWithRole(context);

    const suffix = randomUUID().slice(0, 8);
    const [termA, termB, termC] = await seedCategoryTerms(
      [`District ${suffix} A`, `District ${suffix} B`, `District ${suffix} C`],
      onTestFinished,
    );

    await db.insert(categoryReviewers).values([
      // Instance-wide AND phase-scoped for the same term — must appear once.
      {
        processInstanceId: instanceId,
        taxonomyTermId: termA!.id,
        reviewerProfileId: reviewer.profileId,
      },
      {
        processInstanceId: instanceId,
        taxonomyTermId: termA!.id,
        reviewerProfileId: reviewer.profileId,
        phaseId: 'review',
      },
      // Scoped to the requested phase only.
      {
        processInstanceId: instanceId,
        taxonomyTermId: termB!.id,
        reviewerProfileId: reviewer.profileId,
        phaseId: 'review',
      },
      // Scoped to a different phase — must not match.
      {
        processInstanceId: instanceId,
        taxonomyTermId: termC!.id,
        reviewerProfileId: reviewer.profileId,
        phaseId: 'submission',
      },
    ]);

    const caller = await createAuthenticatedCaller(reviewer.email);

    const withPhase = await caller.decision.listReviewerCategories({
      processInstanceId: instanceId,
      phaseId: 'review',
    });
    expect(withPhase).toEqual([
      { id: termA!.id, name: termA!.label },
      { id: termB!.id, name: termB!.label },
    ]);
  });
});
