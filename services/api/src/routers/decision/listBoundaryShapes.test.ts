import { TestDecisionsDataManager } from '@op/common/testing';
import { db, sql } from '@op/db/client';
import { decisionBoundaries } from '@op/db/schema';
import { inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const gatingInput = { profileId: randomUUID() };

// listBoundaryShapes is an `authenticatedProcedure`: only the editable picker
// calls it (composing a proposal requires a session — anonymous Supabase
// included), so any authenticated tier is admitted and only a no-JWT caller is
// rejected. Mirrors `resolveBoundary`'s gating since the two endpoints feed the
// same picker UI.
describeAccessTierGating('decision.listBoundaryShapes', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.decision.listBoundaryShapes(gatingInput),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(
        caller.decision.listBoundaryShapes(gatingInput),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.decision.listBoundaryShapes(gatingInput),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.decision.listBoundaryShapes(gatingInput),
      );
    },
  ),
});

// Asserts the endpoint actually delivers a parsed GeoJSON MultiPolygon to the
// client (not the raw `ST_AsGeoJSON` string) AND filters strictly by the
// profile scope. The picker overlay won't render at all if the encoder rejects
// the shape, and a scope leak would expose another decision's boundaries — so
// both regressions look like "boundaries silently wrong on the map" and an
// output-shape snapshot catches them.
const SAMPLE_MULTIPOLYGON = `ST_SetSRID(
  ST_Multi(
    ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-74,40],[-73,40],[-73,41],[-74,41],[-74,40]]]}')
  ),
  4326
)`;

describe.concurrent('decision.listBoundaryShapes', () => {
  it('rejects a caller who cannot read the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const decision = await testData.createDecisionSetup({ instanceCount: 1 });
    const outsider = await testData.createDecisionSetup();
    const { session } = await createIsolatedSession(outsider.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.decision.listBoundaryShapes({
        profileId: decision.instance.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('returns each boundary owned by the scoped profile as a parsed GeoJSON MultiPolygon', async ({
    task,
    onTestFinished,
  }) => {
    const { caller, profileId } = await createScopedCaller({
      task,
      onTestFinished,
    });

    const boundaryName = `test-boundary-${randomUUID()}`;
    const [inserted] = await db
      .insert(decisionBoundaries)
      .values({
        profileId,
        name: boundaryName,
        // PostGIS round-trips the polygon through `ST_GeomFromGeoJSON`, so the
        // exact ring we read back tests both the storage and the encoder path.
        boundary: sql`${sql.raw(SAMPLE_MULTIPOLYGON)}`,
      })
      .returning({ id: decisionBoundaries.id });

    onTestFinished(async () => {
      if (inserted) {
        await db
          .delete(decisionBoundaries)
          .where(inArray(decisionBoundaries.id, [inserted.id]));
      }
    });

    const result = await caller.decision.listBoundaryShapes({ profileId });

    const match = result.items.find((b) => b.id === inserted?.id);
    expect(match).toBeDefined();
    expect(match?.name).toBe(boundaryName);
    expect(match?.geometry.type).toBe('MultiPolygon');
    expect(match?.geometry.coordinates[0]?.[0]?.[0]).toEqual([-74, 40]);
  });

  it("does not leak another profile's boundaries", async ({
    task,
    onTestFinished,
  }) => {
    const { caller, profileId: ownProfileId } = await createScopedCaller({
      task,
      onTestFinished,
    });
    const { profileId: otherProfileId } = await createScopedCaller({
      task,
      onTestFinished,
    });

    const [otherBoundary] = await db
      .insert(decisionBoundaries)
      .values({
        profileId: otherProfileId,
        name: `other-boundary-${randomUUID()}`,
        boundary: sql`${sql.raw(SAMPLE_MULTIPOLYGON)}`,
      })
      .returning({ id: decisionBoundaries.id });

    onTestFinished(async () => {
      if (otherBoundary) {
        await db
          .delete(decisionBoundaries)
          .where(inArray(decisionBoundaries.id, [otherBoundary.id]));
      }
    });

    const result = await caller.decision.listBoundaryShapes({
      profileId: ownProfileId,
    });

    expect(
      result.items.find((b) => b.id === otherBoundary?.id),
    ).toBeUndefined();
  });
});

/**
 * Creates a decision the caller can read and returns the caller with the
 * decision profile id, which scopes the boundaries inserted in each test.
 */
async function createScopedCaller({
  task,
  onTestFinished,
}: {
  task: { id: string };
  onTestFinished: (fn: () => void | Promise<void>) => void;
}): Promise<{ caller: ReturnType<typeof createCaller>; profileId: string }> {
  const testData = new TestDecisionsDataManager(task.id, onTestFinished);
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });

  const { session } = await createIsolatedSession(setup.userEmail);
  const caller = createCaller(await createTestContextWithSession(session));

  return { caller, profileId: setup.instance.profileId };
}
