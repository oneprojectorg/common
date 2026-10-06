import { TestDecisionsDataManager } from "@op/common/testing";
import { db } from "@op/db/client";
import { EntityType } from "@op/db/schema";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { appRouter } from "../..";
import {
  createIsolatedSession,
  createTestContextWithSession,
} from "../../../test/supabase-utils";
import { createCallerFactory } from "../../../trpcFactory";

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent("createPhase", () => {
  it("creates a phase and its profile as a decision admin", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.createPhase({
      instanceId,
      name: "Submissions",
      sortOrder: 0,
      data: { phaseId: "submissions" },
    });
    testData.trackProfileForCleanup(result.profileId);

    expect(result).toMatchObject({
      processInstanceId: instanceId,
      sortOrder: 0,
      name: "Submissions",
    });

    const [phase, profile] = await Promise.all([
      db.query.processPhases.findFirst({ where: { id: result.id } }),
      db.query.profiles.findFirst({ where: { id: result.profileId } }),
    ]);
    expect(phase?.data).toEqual({ phaseId: "submissions" });
    expect(profile?.type).toBe(EntityType.PHASE);
    expect(profile?.slug).toBe(result.slug);
  });

  it("rejects a member without decisions ADMIN", async ({
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
    const caller = await createAuthenticatedCaller(member.email);

    const name = `Forbidden ${randomUUID()}`;
    await expect(
      caller.decision.createPhase({
        instanceId: setup.instance.instance.id,
        name,
        sortOrder: 0,
        data: { phaseId: "submissions" },
      }),
    ).rejects.toMatchObject({ cause: { name: "UnauthorizedError" } });

    const leftover = await db.query.profiles.findMany({
      where: { name },
      columns: { id: true },
    });
    expect(leftover).toHaveLength(0);
  });

  it("rejects a user with no access to the decision", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const other = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const caller = await createAuthenticatedCaller(other.userEmail);

    await expect(
      caller.decision.createPhase({
        instanceId: setup.instance.instance.id,
        name: "Submissions",
        sortOrder: 0,
        data: { phaseId: "submissions" },
      }),
    ).rejects.toMatchObject({ cause: { name: "UnauthorizedError" } });
  });

  it("returns not found for an unknown instance", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: true,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createPhase({
        instanceId: randomUUID(),
        name: "Submissions",
        sortOrder: 0,
        data: { phaseId: "submissions" },
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("rejects an empty name and an empty phaseId", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);
    const instanceId = setup.instance.instance.id;

    await expect(
      caller.decision.createPhase({
        instanceId,
        name: "  ",
        sortOrder: 0,
        data: { phaseId: "submissions" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      caller.decision.createPhase({
        instanceId,
        name: "Submissions",
        sortOrder: 0,
        data: { phaseId: "" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires authentication", async () => {
    const caller = createCaller({ session: null, user: null } as never);

    await expect(
      caller.decision.createPhase({
        instanceId: randomUUID(),
        name: "Submissions",
        sortOrder: 0,
        data: { phaseId: "submissions" },
      }),
    ).rejects.toThrow();
  });
});
