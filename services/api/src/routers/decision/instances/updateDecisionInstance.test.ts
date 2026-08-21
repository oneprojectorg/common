import {
  type DecisionInstanceData,
  type RubricTemplateSchema,
} from '@op/common';
import { db, eq } from '@op/db/client';
import { ProcessStatus, processInstances } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
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

async function getFirstPhaseId(instanceId: string) {
  const dbInstance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });
  const phaseId = (dbInstance!.instanceData as DecisionInstanceData).phases[0]
    ?.phaseId;

  if (!phaseId) {
    throw new Error('No phases found in instance');
  }

  return phaseId;
}

describe.concurrent('updateDecisionInstance', () => {
  it('should update instance name', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const newName = `Updated Name ${task.id}`;
    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      name: newName,
    });

    expect(result.processInstance.name).toBe(newName);
    expect(result.processInstance.id).toBe(instance.instance.id);
  });

  it('should not update slug when renaming a draft instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Capture the original slug (UUID-based) from a no-op update call
    const before = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
    });
    const slugBefore = before.slug;

    const newName = `My Awesome Process ${task.id}`;
    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      name: newName,
    });

    expect(result.processInstance.name).toBe(newName);

    // Slug should stay the same — drafts keep their original UUID slug
    expect(result.slug).toBe(slugBefore);
  });

  it('should generate a name-based slug when publishing a draft', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Rename the draft first
    const newName = `My Awesome Process ${task.id}`;
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      name: newName,
    });

    // Publish — slug should now be generated from the name
    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      status: ProcessStatus.PUBLISHED,
    });

    expect(result.slug).toContain('decision-my-awesome-process');
  });

  it('should not update slug when renaming a published instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Publish the instance
    const published = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      status: ProcessStatus.PUBLISHED,
    });

    const slugAfterPublish = published.slug;

    // Update the name on the published instance
    const newName = `Renamed Published Process ${task.id}`;
    const renamed = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      name: newName,
    });

    // Verify the slug was NOT changed
    expect(renamed.slug).toBe(slugAfterPublish);
    expect(renamed.name).toBe(newName);
  });

  it('should update instance description', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const newDescription = `Updated description for ${task.id}`;
    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      description: newDescription,
    });

    expect(result.processInstance.description).toBe(newDescription);
  });

  it('should update instance status to published', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      status: ProcessStatus.PUBLISHED,
    });

    expect(result.processInstance.status).toBe(ProcessStatus.PUBLISHED);
  });

  it('should update config hideBudget setting', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: { hideBudget: true },
    });

    // Verify the config was updated in the database
    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });

    const instanceData = dbInstance!.instanceData as DecisionInstanceData;
    expect(instanceData.config?.hideBudget).toBe(true);
    expect(result.processInstance.id).toBe(instance.instance.id);
  });

  it('should round-trip overview content through update and getInstance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const overview = {
      headline: `Overview headline ${task.id}`,
      description: 'A short description for the overview page',
      // New bodies are TipTap JSON docs (editor.getJSON()).
      body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Overview body text' }],
          },
        ],
      },
    };

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      overview,
    });

    // Round-trip through getInstance — this also guards the encoder: if
    // `overview` were dropped from instanceDataWithSchemaEncoder, zod would
    // strip it from the response and the editor would initialize empty.
    const fetched = await caller.decision.getInstance({
      instanceId: instance.instance.id,
    });

    expect(fetched.instanceData?.overview).toEqual(overview);
  });

  it('should round-trip a legacy HTML string overview body', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Bodies written before the JSON migration are HTML strings; they must
    // still read and write unchanged (the renderer falls back to HTML).
    const overview = {
      headline: `Legacy body ${task.id}`,
      body: '<p>Overview body text</p>',
    };

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      overview,
    });

    const fetched = await caller.decision.getInstance({
      instanceId: instance.instance.id,
    });

    expect(fetched.instanceData?.overview).toEqual(overview);
  });

  it('should preserve sibling instanceData and overview fields when updating overview', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Seed unrelated instanceData and a full overview
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: { hideBudget: true },
    });
    const body = '<p>Body</p>';
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      overview: { headline: 'Original headline', description: 'Desc', body },
    });

    // Partial overview update — only the headline changes
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      overview: { headline: 'New headline' },
    });

    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const instanceData = dbInstance!.instanceData as DecisionInstanceData;

    // Sibling instanceData fields survive overview updates
    expect(instanceData.config?.hideBudget).toBe(true);
    expect(instanceData.phases.length).toBeGreaterThan(0);

    // Unspecified overview fields are preserved by the merge
    expect(instanceData.overview?.headline).toBe('New headline');
    expect(instanceData.overview?.description).toBe('Desc');
    expect(instanceData.overview?.body).toEqual(body);
  });

  it('should reject an empty overview headline', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      overview: { headline: 'Keep me', description: 'Desc' },
    });

    // An empty title is not valid content — the endpoint rejects it rather
    // than coercing it to a cleared headline.
    await expect(
      caller.decision.updateDecisionInstance({
        instanceId: instance.instance.id,
        overview: { headline: '' },
      }),
    ).rejects.toThrow(/Headline cannot be empty/i);

    // Whitespace-only is the same empty title.
    await expect(
      caller.decision.updateDecisionInstance({
        instanceId: instance.instance.id,
        overview: { headline: '   ' },
      }),
    ).rejects.toThrow(/Headline cannot be empty/i);

    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const instanceData = dbInstance!.instanceData as DecisionInstanceData;

    // The rejected writes changed nothing.
    expect(instanceData.overview?.headline).toBe('Keep me');
    expect(instanceData.overview?.description).toBe('Desc');
  });

  it('should reject an empty phase headline', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const firstPhaseId = await getFirstPhaseId(instance.instance.id);

    await expect(
      caller.decision.updateDecisionInstance({
        instanceId: instance.instance.id,
        phases: [{ phaseId: firstPhaseId, headline: '  ' }],
      }),
    ).rejects.toThrow(/Headline cannot be empty/i);
  });

  it('should clear the overview headline with null and keep a cleared description', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      overview: { headline: 'To be cleared', description: 'Also cleared' },
    });

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      overview: { headline: null, description: '' },
    });

    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const instanceData = dbInstance!.instanceData as DecisionInstanceData;

    // A cleared headline is the *absence* of a headline, so the hero title
    // falls back to the default copy. The description has no default copy
    // behind it, so `''` stays as written.
    expect(instanceData.overview).not.toHaveProperty('headline');
    expect(instanceData.overview?.description).toBe('');
  });

  it('should clear a phase headline with null', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const firstPhaseId = await getFirstPhaseId(instance.instance.id);

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      phases: [{ phaseId: firstPhaseId, headline: '  To be cleared  ' }],
    });

    const seeded = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    // Stored trimmed, not as typed.
    expect(
      (seeded!.instanceData as DecisionInstanceData).phases.find(
        (phase) => phase.phaseId === firstPhaseId,
      )?.headline,
    ).toBe('To be cleared');

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      phases: [{ phaseId: firstPhaseId, headline: null }],
    });

    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const storedPhase = (
      dbInstance!.instanceData as DecisionInstanceData
    ).phases.find((phase) => phase.phaseId === firstPhaseId);

    expect(storedPhase).not.toHaveProperty('headline');
    // Sibling phase data survives the clear.
    expect(storedPhase?.name).toBeDefined();
  });

  it('should read a stored blank headline as absent', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    // Rows written before the endpoint rejected an empty title hold
    // `headline: ''`. Plant one directly and read it back.
    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const seededData = dbInstance!.instanceData as DecisionInstanceData;
    const firstPhase = seededData.phases[0];

    if (!firstPhase) {
      throw new Error('No phases found in instance');
    }

    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...seededData,
          overview: { headline: '', description: 'Kept' },
          phases: [
            { ...firstPhase, headline: '' },
            ...seededData.phases.slice(1),
          ],
        },
      })
      .where(eq(processInstances.id, instance.instance.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const fetched = await caller.decision.getInstance({
      instanceId: instance.instance.id,
    });

    // Absent, so the hero-title fallback chains reach the default copy.
    expect(fetched.instanceData?.overview?.headline).toBeUndefined();
    expect(fetched.instanceData?.overview?.description).toBe('Kept');
    expect(
      fetched.instanceData?.phases?.find(
        (phase) => phase.phaseId === firstPhase.phaseId,
      )?.headline,
    ).toBeUndefined();
  });

  it('should degrade a malformed stored overview body without dropping sibling fields', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    // Plant a corrupt overview shape (body is neither an HTML string nor a
    // JSON doc — here a number) directly in the database. Both string and
    // object bodies are valid now, so this is the genuinely-malformed case.
    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const corruptInstanceData = {
      ...(dbInstance!.instanceData as DecisionInstanceData),
      overview: {
        headline: 'Corrupt body',
        body: 12345,
      },
    };
    await db
      .update(processInstances)
      .set({
        instanceData: corruptInstanceData as unknown as DecisionInstanceData,
      })
      .where(eq(processInstances.id, instance.instance.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // The read must not fail. The malformed body degrades to undefined, but the
    // body-scoped `.catch` keeps headline/description intact (and the whole
    // instance, and any list containing it, still reads).
    const fetched = await caller.decision.getInstance({
      instanceId: instance.instance.id,
    });

    expect(fetched.id).toBe(instance.instance.id);
    expect(fetched.instanceData?.overview?.headline).toBe('Corrupt body');
    expect(fetched.instanceData?.overview?.body).toBeUndefined();
  });

  it('should update phase settings', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Get current phases to know which phase IDs exist
    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const currentData = dbInstance!.instanceData as DecisionInstanceData;
    const firstPhaseId = currentData.phases[0]?.phaseId;

    if (!firstPhaseId) {
      throw new Error('No phases found in instance');
    }

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      phases: [
        {
          phaseId: firstPhaseId,
          settings: { maxProposalsPerMember: 10 },
        },
      ],
    });

    // Verify the settings were updated
    const updatedInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });

    const instanceData = updatedInstance!.instanceData as DecisionInstanceData;

    const firstPhase = instanceData.phases.find(
      (p) => p.phaseId === firstPhaseId,
    );
    expect(firstPhase?.settings?.maxProposalsPerMember).toBe(10);
  });

  it('should update multiple fields at once', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const newName = `Multi-update ${task.id}`;
    const newDescription = `Multi-update description ${task.id}`;

    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      name: newName,
      description: newDescription,
      status: ProcessStatus.PUBLISHED,
      config: { hideBudget: true },
    });

    expect(result.processInstance.name).toBe(newName);
    expect(result.processInstance.description).toBe(newDescription);
    expect(result.processInstance.status).toBe(ProcessStatus.PUBLISHED);

    // Verify config in database
    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });

    const instanceData = dbInstance!.instanceData as DecisionInstanceData;
    expect(instanceData.config?.hideBudget).toBe(true);

    // Verify slug was generated from the name on publish
    expect(result.slug).toContain('decision-multi-update');
  });

  it('should not allow non-admin to update instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    // Create a member user (non-admin)
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const nonAdminCaller = await createAuthenticatedCaller(memberUser.email);

    // Non-admin should NOT be able to update the instance
    // Note: assertAccess throws AccessControlException which may be wrapped as INTERNAL_SERVER_ERROR
    // The important thing is that the operation is denied
    await expect(
      nonAdminCaller.decision.updateDecisionInstance({
        instanceId: instance.instance.id,
        name: 'Should Fail',
      }),
    ).rejects.toThrow();
  });

  it('should require authentication', async ({ task }) => {
    const caller = createCaller({
      session: null,
      user: null,
    } as never);

    await expect(
      caller.decision.updateDecisionInstance({
        instanceId: '00000000-0000-0000-0000-000000000000',
        name: `Auth Test ${task.id}`,
      }),
    ).rejects.toThrow();
  });

  it('should return 404 for non-existent instance', async ({
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
      caller.decision.updateDecisionInstance({
        instanceId: '00000000-0000-0000-0000-000000000000',
        name: `Not Found Test ${task.id}`,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('should return existing profile when no updates provided', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Call with only instanceId - no actual updates
    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
    });

    expect(result.id).toBe(instance.profileId);
    expect(result.processInstance.id).toBe(instance.instance.id);
  });

  it('should update phases on a published instance with only endDate', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Publish the instance first
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      status: ProcessStatus.PUBLISHED,
    });

    // Get current phases
    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const currentData = dbInstance!.instanceData as DecisionInstanceData;

    // Update phases with only endDate (no startDate) — should not throw
    const endDate = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      phases: currentData.phases.map((p) => ({
        phaseId: p.phaseId,
        endDate,
      })),
    });

    expect(result.processInstance.id).toBe(instance.instance.id);

    // Verify phases were updated in the database
    const updatedInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const updatedData = updatedInstance!.instanceData as DecisionInstanceData;
    for (const phase of updatedData.phases) {
      expect(phase.endDate).toBe(endDate);
    }
  });

  it('should accept and persist a valid proposalTemplate', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const validTemplate = {
      type: 'object',
      properties: {
        title: { type: 'string', title: 'Project Title' },
        budget: { type: 'number', minimum: 0 },
      },
      required: ['title'],
    };

    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      proposalTemplate: validTemplate,
    });

    expect(result.processInstance.id).toBe(instance.instance.id);

    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });

    const instanceData = dbInstance!.instanceData as DecisionInstanceData;
    expect(instanceData.proposalTemplate).toBeDefined();
    expect(instanceData.proposalTemplate?.properties).toHaveProperty('title');
    expect(instanceData.proposalTemplate?.properties).toHaveProperty('budget');
  });

  it('should reject an invalid proposalTemplate and not persist it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const beforeInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const beforeData = beforeInstance!.instanceData as DecisionInstanceData;

    // Invalid: "bogus" is not a valid JSON Schema type
    await expect(
      caller.decision.updateDecisionInstance({
        instanceId: instance.instance.id,
        proposalTemplate: { type: 'bogus' },
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });

    // Verify nothing was persisted
    const afterInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const afterData = afterInstance!.instanceData as DecisionInstanceData;
    expect(afterData.proposalTemplate).toEqual(beforeData.proposalTemplate);
  });

  it('should accept and persist a valid rubricTemplate', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const validRubricTemplate: RubricTemplateSchema = {
      type: 'object',
      'x-field-order': [
        'innovation',
        'feasibility',
        'communityImpact',
        'overallComments',
      ],
      properties: {
        innovation: {
          type: 'integer',
          title: 'Innovation',
          description: 'How innovative is the proposal?',
          'x-format': 'dropdown',
          minimum: 1,
          maximum: 5,
          oneOf: [
            { const: 1, title: 'Poor' },
            { const: 2, title: 'Below Average' },
            { const: 3, title: 'Average' },
            { const: 4, title: 'Good' },
            { const: 5, title: 'Excellent' },
          ],
        },
        feasibility: {
          type: 'integer',
          title: 'Feasibility',
          description: 'How feasible is the proposal to implement?',
          'x-format': 'dropdown',
          minimum: 1,
          maximum: 5,
          oneOf: [
            { const: 1, title: 'Poor' },
            { const: 2, title: 'Below Average' },
            { const: 3, title: 'Average' },
            { const: 4, title: 'Good' },
            { const: 5, title: 'Excellent' },
          ],
        },
        communityImpact: {
          type: 'integer',
          title: 'Community Impact',
          description: 'What is the expected impact on the community?',
          'x-format': 'dropdown',
          minimum: 1,
          maximum: 5,
          oneOf: [
            { const: 1, title: 'Poor' },
            { const: 2, title: 'Below Average' },
            { const: 3, title: 'Average' },
            { const: 4, title: 'Good' },
            { const: 5, title: 'Excellent' },
          ],
        },
        overallComments: {
          type: 'string',
          title: 'Overall Comments',
          description: 'Provide detailed feedback for the proposer.',
          'x-format': 'long-text',
        },
      },
      required: ['innovation', 'feasibility', 'communityImpact'],
    };

    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      rubricTemplate: validRubricTemplate,
    });

    expect(result.processInstance.id).toBe(instance.instance.id);

    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });

    const instanceData = dbInstance!.instanceData as DecisionInstanceData;
    expect(instanceData.rubricTemplate).toBeDefined();
    expect(instanceData.rubricTemplate).toMatchObject({
      'x-field-order': [
        'innovation',
        'feasibility',
        'communityImpact',
        'overallComments',
      ],
      required: ['innovation', 'feasibility', 'communityImpact'],
    });
    expect(
      (instanceData.rubricTemplate?.properties as Record<string, unknown>)
        ?.innovation,
    ).toMatchObject({
      type: 'integer',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: 'Poor' },
        { const: 2, title: 'Below Average' },
        { const: 3, title: 'Average' },
        { const: 4, title: 'Good' },
        { const: 5, title: 'Excellent' },
      ],
    });
    expect(
      (instanceData.rubricTemplate?.properties as Record<string, unknown>)
        ?.overallComments,
    ).toMatchObject({ 'x-format': 'long-text' });
  });

  it('should reject an invalid rubricTemplate and not persist it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const beforeInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const beforeData = beforeInstance!.instanceData as DecisionInstanceData;

    // Invalid: "bogus" is not a valid JSON Schema type
    await expect(
      caller.decision.updateDecisionInstance({
        instanceId: instance.instance.id,
        // @ts-expect-error testing runtime rejection of invalid JSON Schema type
        rubricTemplate: { type: 'bogus' },
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });

    // Verify nothing was persisted
    const afterInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const afterData = afterInstance!.instanceData as DecisionInstanceData;
    expect(afterData.rubricTemplate).toEqual(beforeData.rubricTemplate);
  });

  it('should update phases on a published instance when some phases have no dates', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Publish the instance first
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      status: ProcessStatus.PUBLISHED,
    });

    // Get current phases
    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const currentData = dbInstance!.instanceData as DecisionInstanceData;
    const phaseIds = currentData.phases.map((p) => p.phaseId);

    // Send phases with no dates at all — should succeed (transitions skipped)
    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      phases: phaseIds.map((phaseId) => ({
        phaseId,
        name: `Updated ${phaseId}`,
      })),
    });

    expect(result.processInstance.id).toBe(instance.instance.id);

    // Verify names were updated
    const updatedInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const updatedData = updatedInstance!.instanceData as DecisionInstanceData;
    for (const phase of updatedData.phases) {
      expect(phase.name).toBe(`Updated ${phase.phaseId}`);
    }
  });

  it('should allow process owner to update steward', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Use the org profile as the new steward (it's a valid profile the owner controls)
    const newStewardId = setup.organization.profileId;

    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      stewardProfileId: newStewardId,
    });

    expect(result.processInstance.id).toBe(instance.instance.id);

    // Verify the steward was updated in the database
    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });

    expect(dbInstance!.stewardProfileId).toBe(newStewardId);
  });

  it('should not allow non-owner admin to change steward', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    // Create a member user and grant them admin access on the decision profile
    // (skip instanceProfileIds to avoid duplicate profileUsers rows)
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
    });

    // Grant admin access on the decision profile so they pass the general
    // admin check but are still not the process owner
    await testData.grantProfileAccess(
      instance.profileId,
      memberUser.authUserId,
      memberUser.email,
    );

    const memberCaller = await createAuthenticatedCaller(memberUser.email);

    // Non-owner admin should NOT be able to change the steward
    await expect(
      memberCaller.decision.updateDecisionInstance({
        instanceId: instance.instance.id,
        stewardProfileId: memberUser.profileId,
      }),
    ).rejects.toThrow();
  });

  it('should allow non-owner admin to update other fields without changing steward', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    // Create a member user and grant them admin access on the decision profile
    // (skip instanceProfileIds to avoid duplicate profileUsers rows)
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
    });

    await testData.grantProfileAccess(
      instance.profileId,
      memberUser.authUserId,
      memberUser.email,
    );

    const memberCaller = await createAuthenticatedCaller(memberUser.email);

    // Non-owner admin should still be able to update other fields
    const newName = `Updated by member ${task.id}`;
    const result = await memberCaller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      name: newName,
    });

    expect(result.processInstance.name).toBe(newName);
  });
});

describeDecisionAccessTierGating('updateDecisionInstance', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.updateDecisionInstance({
          instanceId: instance.instance.id,
          name: 'should not reach',
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.updateDecisionInstance({
          instanceId: instance.instance.id,
          name: 'should bounce',
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.updateDecisionInstance({
          instanceId: instance.instance.id,
          name: 'should bounce',
        }),
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.updateDecisionInstance({
        instanceId: instance.instance.id,
        name: `Renamed ${task.id}`,
      });
      expect(result.processInstance.name).toBe(`Renamed ${task.id}`);
    },
  ),
});
