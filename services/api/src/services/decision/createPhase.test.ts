import {
  NotFoundError,
  UnauthorizedError,
  createPhase,
  deletePhase,
  renamePhase,
} from "@op/common";
import { TestDecisionsDataManager } from "@op/common/testing";
import { db } from "@op/db/client";
import { EntityType } from "@op/db/schema";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

describe.concurrent("createPhase", () => {
  it("mints a profile of type PHASE that owns the name", async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user, testData } = await setup(task, onTestFinished);

    const { phase, profile } = await createPhase({
      user,
      processInstanceId: instanceId,
      name: "Submissions",
      sortOrder: 0,
      data: { phaseId: "submissions" },
    });
    testData.trackProfileForCleanup(profile.id);

    expect(profile.type).toBe(EntityType.PHASE);
    expect(profile.name).toBe("Submissions");
    expect(phase.profileId).toBe(profile.id);
    expect(phase.processInstanceId).toBe(instanceId);
    expect(phase.sortOrder).toBe(0);
  });

  it("slugs the profile from the name rather than the id", async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user, testData } = await setup(task, onTestFinished);

    const { profile } = await createPhase({
      user,
      processInstanceId: instanceId,
      name: `Review Round ${randomUUID()}`,
      sortOrder: 1,
      data: { phaseId: "review" },
    });
    testData.trackProfileForCleanup(profile.id);

    expect(profile.slug.startsWith("review-round-")).toBe(true);
  });

  it("keeps phaseId in data and the name out of it", async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user, testData } = await setup(task, onTestFinished);

    const { phase, profile } = await createPhase({
      user,
      processInstanceId: instanceId,
      name: "Voting",
      sortOrder: 2,
      data: { phaseId: "voting" },
    });
    testData.trackProfileForCleanup(profile.id);

    expect(phase.data).toEqual({ phaseId: "voting" });
  });

  it("rejects data with an empty phaseId", async ({ task, onTestFinished }) => {
    const { instanceId, user } = await setup(task, onTestFinished);

    // phaseId is what joins the row to its entry in instance_data.phases.
    await expect(
      createPhase({
        user,
        processInstanceId: instanceId,
        name: "Nameless",
        sortOrder: 0,
        data: { phaseId: "" },
      }),
    ).rejects.toThrow();
  });

  it("writes no roles and no members on the phase profile", async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user, testData } = await setup(task, onTestFinished);

    const { profile } = await createPhase({
      user,
      processInstanceId: instanceId,
      name: "Review",
      sortOrder: 0,
      data: { phaseId: "review" },
    });
    testData.trackProfileForCleanup(profile.id);

    const [roles, members] = await Promise.all([
      db.query.accessRoles.findMany({
        where: { profileId: profile.id },
        columns: { id: true },
      }),
      db.query.profileUsers.findMany({
        where: { profileId: profile.id },
        columns: { id: true },
      }),
    ]);
    expect(roles).toHaveLength(0);
    expect(members).toHaveLength(0);
  });

  it("opens no transaction, so a caller rollback takes the profile too", async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user } = await setup(task, onTestFinished);

    const name = `Rolled Back ${randomUUID()}`;
    await expect(
      db.transaction(async (tx) => {
        await createPhase({
          user,
          processInstanceId: instanceId,
          name,
          sortOrder: 0,
          data: { phaseId: "submissions" },
          db: tx,
        });
        throw new Error("caller aborts");
      }),
    ).rejects.toThrow("caller aborts");

    const leftover = await db.query.profiles.findMany({
      where: { name },
      columns: { id: true },
    });
    expect(leftover).toHaveLength(0);
  });

  it("throws NotFoundError for an unknown instance", async ({
    task,
    onTestFinished,
  }) => {
    const { user } = await setup(task, onTestFinished);

    await expect(
      createPhase({
        user,
        processInstanceId: randomUUID(),
        name: "Nowhere",
        sortOrder: 0,
        data: { phaseId: "submissions" },
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects a member without decisions ADMIN and writes nothing", async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, instanceProfileId, organization, testData } =
      await setup(task, onTestFinished);

    const member = await testData.createMemberUser({
      organization,
      instanceProfileIds: [instanceProfileId],
    });

    const name = `Forbidden ${randomUUID()}`;
    await expect(
      createPhase({
        user: member.user,
        processInstanceId: instanceId,
        name,
        sortOrder: 0,
        data: { phaseId: "submissions" },
      }),
    ).rejects.toThrow(UnauthorizedError);

    const leftover = await db.query.profiles.findMany({
      where: { name },
      columns: { id: true },
    });
    expect(leftover).toHaveLength(0);
  });
});

describe.concurrent("renamePhase", () => {
  it("writes the profile name and leaves the slug alone", async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user, testData } = await setup(task, onTestFinished);

    const { phase, profile } = await createPhase({
      user,
      processInstanceId: instanceId,
      name: `Before ${randomUUID()}`,
      sortOrder: 0,
      data: { phaseId: "submissions" },
    });
    testData.trackProfileForCleanup(profile.id);

    const renamed = await renamePhase({ phaseId: phase.id, name: "After" });

    expect(renamed.name).toBe("After");
    expect(renamed.slug).toBe(profile.slug);
  });

  it("throws NotFoundError for an unknown phase", async () => {
    await expect(
      renamePhase({ phaseId: randomUUID(), name: "After" }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe.concurrent("deletePhase", () => {
  it("deletes the profile and lets the cascade take the phase", async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, user } = await setup(task, onTestFinished);

    const { phase, profile } = await createPhase({
      user,
      processInstanceId: instanceId,
      name: `Doomed ${randomUUID()}`,
      sortOrder: 0,
      data: { phaseId: "submissions" },
    });

    await deletePhase({ phaseId: phase.id });

    const remainingProfile = await db.query.profiles.findFirst({
      where: { id: profile.id },
      columns: { id: true },
    });
    const remainingPhase = await db.query.processPhases.findFirst({
      where: { id: phase.id },
      columns: { id: true },
    });

    expect(remainingProfile).toBeUndefined();
    expect(remainingPhase).toBeUndefined();
  });

  it("throws NotFoundError for an unknown phase", async () => {
    await expect(deletePhase({ phaseId: randomUUID() })).rejects.toThrow(
      NotFoundError,
    );
  });
});

const setup = async (
  task: { id: string },
  onTestFinished: (fn: () => void | Promise<void>) => void,
) => {
  const testData = new TestDecisionsDataManager(task.id, onTestFinished);
  const decisionSetup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });

  return {
    instanceId: decisionSetup.instance.instance.id,
    instanceProfileId: decisionSetup.instance.profileId,
    organization: decisionSetup.organization,
    user: decisionSetup.user,
    testData,
  };
};
