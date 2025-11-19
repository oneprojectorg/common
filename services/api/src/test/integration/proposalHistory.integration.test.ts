import {
  createInstance,
  createOrganization,
  createProcess,
  createProposal,
  updateProposal,
} from '@op/common';
import { db, eq, sql } from '@op/db/client';
import { proposalHistory, proposals } from '@op/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  cleanupTestData,
  createTestUser,
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

describe('Proposal History Integration Tests', () => {
  let testUserEmail: string;
  let testUser: any;
  let testOrganization: any;

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData([
      'decision_proposal_history',
      'decision_proposals',
      'decision_process_instances',
      'decision_processes',
      'organization_users',
      'organizations',
      'profiles',
    ]);
    await signOutTestUser();

    // Create fresh test user for each test
    testUserEmail = `test-history-${Date.now()}@example.com`;
    await createTestUser(testUserEmail);
    await signInTestUser(testUserEmail);

    // Get the authenticated user for service calls
    const session = await getCurrentTestSession();
    testUser = session?.user;

    // Create a test organization
    testOrganization = await createOrganization({
      data: {
        name: 'Test Organization',
        website: 'https://test.com',
        email: 'test@test.com',
        orgType: 'nonprofit',
        bio: 'Test organization',
        mission: 'Testing',
        networkOrganization: false,
        isReceivingFunds: false,
        isOfferingFunds: false,
        acceptingApplications: false,
      },
      user: testUser,
    });
  });

  it('should create history record when proposal data is updated', async () => {
    // Create process
    const process = await createProcess({
      data: {
        name: 'Test Process',
        description: 'Test process for history tracking',
        processSchema: {
          name: 'Test Process',
          description: 'Test',
          states: [
            {
              id: 'draft',
              name: 'Draft',
              type: 'initial',
              config: { allowProposals: true, allowDecisions: false },
            },
          ],
          phases: [{id: "phase1", name: "Phase 1", states: ["draft"]}], transitions: [],
          initialState: 'draft',
          decisionDefinition: {
            type: 'object',
            properties: { approved: { type: 'boolean' } },
            required: ['approved'],
          },
          proposalTemplate: {
            type: 'object',
            properties: {
              title: { type: 'string', minLength: 3 },
              description: { type: 'string' },
            },
            required: ['title'],
          },
        },
      },
      user: testUser,
    });

    // Create instance
    const instance = await createInstance({
      data: {
        processId: process.id,
        name: 'Test Instance',
        description: 'Test instance for history tracking',
        instanceData: {
          currentStateId: 'draft',
          fieldValues: {},
          phases: [
            {
              stateId: 'draft',
              plannedStartDate: new Date().toISOString(),
              plannedEndDate: new Date(Date.now() + 86400000).toISOString(),
            },
          ],
        },
      },
      user: testUser,
    });

    // Create proposal
    const proposal = await createProposal({
      data: {
        processInstanceId: instance.id,
        proposalData: {
          title: 'Original Title',
          description: 'Original Description',
        },
        authUserId: testUser.id,
      },
      authUserId: testUser.id,
    });

    // Wait to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Update proposal
    await updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: {
          title: 'Updated Title',
          description: 'Updated Description',
        },
      },
      user: testUser,
    });

    // Verify history was created
    const historyRecords = await db.query.proposalHistory.findMany({
      where: eq(proposalHistory.id, proposal.id),
    });

    expect(historyRecords).toHaveLength(1);

    const historyRecord = historyRecords[0]!;
    expect(historyRecord).toBeDefined();
    expect(historyRecord.id).toBe(proposal.id);
    expect(historyRecord.proposalData).toEqual({
      title: 'Original Title',
      description: 'Original Description',
    });
    expect(historyRecord.historyId).toBeDefined();
    expect(historyRecord.validDuring).toBeDefined();
    expect(historyRecord.historyCreatedAt).toBeDefined();
    expect(historyRecord.lastEditedByProfileId).toBeDefined();
  });

  it('should create history record when status is updated', async () => {
    // Create process
    const process = await createProcess({
      data: {
        name: 'Test Process',
        description: 'Test',
        processSchema: {
          name: 'Test Process',
          description: 'Test',
          states: [
            {
              id: 'draft',
              name: 'Draft',
              type: 'initial',
              config: { allowProposals: true, allowDecisions: false },
            },
          ],
          phases: [{id: "phase1", name: "Phase 1", states: ["draft"]}], transitions: [],
          initialState: 'draft',
          decisionDefinition: {
            type: 'object',
            properties: { approved: { type: 'boolean' } },
            required: ['approved'],
          },
          proposalTemplate: {
            type: 'object',
            properties: {
              title: { type: 'string', minLength: 3 },
            },
            required: ['title'],
          },
        },
      },
      user: testUser,
    });

    const instance = await createInstance({
      data: {
        processId: process.id,
        name: 'Test Instance',
        description: 'Test',
        instanceData: {
          currentStateId: 'draft',
          fieldValues: {},
          phases: [
            {
              stateId: 'draft',
              plannedStartDate: new Date().toISOString(),
              plannedEndDate: new Date(Date.now() + 86400000).toISOString(),
            },
          ],
        },
      },
      user: testUser,
    });

    const proposal = await createProposal({
      data: {
        processInstanceId: instance.id,
        proposalData: { title: 'Test Title' },
        authUserId: testUser.id,
      },
      authUserId: testUser.id,
    });

    const originalStatus = proposal.status;

    // Wait to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Update status
    await updateProposal({
      proposalId: proposal.id,
      data: { status: 'submitted' },
      user: testUser,
    });

    // Verify history captured original status
    const historyRecords = await db.query.proposalHistory.findMany({
      where: eq(proposalHistory.id, proposal.id),
    });

    expect(historyRecords).toHaveLength(1);
    expect(historyRecords[0]!.status).toBe(originalStatus);
  });

  it('should NOT create history when only updatedAt changes', async () => {
    // Create process
    const process = await createProcess({
      data: {
        name: 'Test Process',
        description: 'Test',
        processSchema: {
          name: 'Test Process',
          description: 'Test',
          states: [
            {
              id: 'draft',
              name: 'Draft',
              type: 'initial',
              config: { allowProposals: true, allowDecisions: false },
            },
          ],
          phases: [{id: "phase1", name: "Phase 1", states: ["draft"]}], transitions: [],
          initialState: 'draft',
          decisionDefinition: {
            type: 'object',
            properties: { approved: { type: 'boolean' } },
            required: ['approved'],
          },
          proposalTemplate: {
            type: 'object',
            properties: {
              title: { type: 'string', minLength: 3 },
            },
            required: ['title'],
          },
        },
      },
      user: testUser,
    });

    const instance = await createInstance({
      data: {
        processId: process.id,
        name: 'Test Instance',
        description: 'Test',
        instanceData: {
          currentStateId: 'draft',
          fieldValues: {},
          phases: [
            {
              stateId: 'draft',
              plannedStartDate: new Date().toISOString(),
              plannedEndDate: new Date(Date.now() + 86400000).toISOString(),
            },
          ],
        },
      },
      user: testUser,
    });

    const proposal = await createProposal({
      data: {
        processInstanceId: instance.id,
        proposalData: { title: 'Test Title' },
        authUserId: testUser.id,
      },
      authUserId: testUser.id,
    });

    // Manually update only updatedAt (simulating a touch)
    await db
      .update(proposals)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(proposals.id, proposal.id));

    // Verify NO history was created
    const historyRecords = await db.query.proposalHistory.findMany({
      where: eq(proposalHistory.id, proposal.id),
    });

    expect(historyRecords).toHaveLength(0);
  });

  it('should create multiple history records for multiple updates', async () => {
    // Create process
    const process = await createProcess({
      data: {
        name: 'Test Process',
        description: 'Test',
        processSchema: {
          name: 'Test Process',
          description: 'Test',
          states: [
            {
              id: 'draft',
              name: 'Draft',
              type: 'initial',
              config: { allowProposals: true, allowDecisions: false },
            },
          ],
          phases: [{id: "phase1", name: "Phase 1", states: ["draft"]}], transitions: [],
          initialState: 'draft',
          decisionDefinition: {
            type: 'object',
            properties: { approved: { type: 'boolean' } },
            required: ['approved'],
          },
          proposalTemplate: {
            type: 'object',
            properties: {
              title: { type: 'string', minLength: 3 },
            },
            required: ['title'],
          },
        },
      },
      user: testUser,
    });

    const instance = await createInstance({
      data: {
        processId: process.id,
        name: 'Test Instance',
        description: 'Test',
        instanceData: {
          currentStateId: 'draft',
          fieldValues: {},
          phases: [
            {
              stateId: 'draft',
              plannedStartDate: new Date().toISOString(),
              plannedEndDate: new Date(Date.now() + 86400000).toISOString(),
            },
          ],
        },
      },
      user: testUser,
    });

    const proposal = await createProposal({
      data: {
        processInstanceId: instance.id,
        proposalData: { title: 'Version 1' },
        authUserId: testUser.id,
      },
      authUserId: testUser.id,
    });

    // Update 1
    await new Promise((resolve) => setTimeout(resolve, 100));
    await updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: { title: 'Version 2' },
      },
      user: testUser,
    });

    // Update 2
    await new Promise((resolve) => setTimeout(resolve, 100));
    await updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: { title: 'Version 3' },
      },
      user: testUser,
    });

    // Verify 2 history records (original + first update)
    const historyRecords = await db.query.proposalHistory.findMany({
      where: eq(proposalHistory.id, proposal.id),
      orderBy: (table, { desc }) => [desc(sql`lower(${table.validDuring})`)],
    });

    expect(historyRecords).toHaveLength(2);
    expect(historyRecords[0]!.proposalData).toEqual({ title: 'Version 2' });
    expect(historyRecords[1]!.proposalData).toEqual({ title: 'Version 1' });
  });

  it('should have valid temporal ranges', async () => {
    // Create process
    const process = await createProcess({
      data: {
        name: 'Test Process',
        description: 'Test',
        processSchema: {
          name: 'Test Process',
          description: 'Test',
          states: [
            {
              id: 'draft',
              name: 'Draft',
              type: 'initial',
              config: { allowProposals: true, allowDecisions: false },
            },
          ],
          phases: [{id: "phase1", name: "Phase 1", states: ["draft"]}], transitions: [],
          initialState: 'draft',
          decisionDefinition: {
            type: 'object',
            properties: { approved: { type: 'boolean' } },
            required: ['approved'],
          },
          proposalTemplate: {
            type: 'object',
            properties: {
              title: { type: 'string', minLength: 3 },
            },
            required: ['title'],
          },
        },
      },
      user: testUser,
    });

    const instance = await createInstance({
      data: {
        processId: process.id,
        name: 'Test Instance',
        description: 'Test',
        instanceData: {
          currentStateId: 'draft',
          fieldValues: {},
          phases: [
            {
              stateId: 'draft',
              plannedStartDate: new Date().toISOString(),
              plannedEndDate: new Date(Date.now() + 86400000).toISOString(),
            },
          ],
        },
      },
      user: testUser,
    });

    const proposal = await createProposal({
      data: {
        processInstanceId: instance.id,
        proposalData: { title: 'Original' },
        authUserId: testUser.id,
      },
      authUserId: testUser.id,
    });

    // Update
    await new Promise((resolve) => setTimeout(resolve, 100));
    await updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: { title: 'Updated' },
      },
      user: testUser,
    });

    // Verify temporal range
    const historyRecords = await db.query.proposalHistory.findMany({
      where: eq(proposalHistory.id, proposal.id),
    });

    expect(historyRecords).toHaveLength(1);

    const historyRecord = historyRecords[0]!;
    expect(historyRecord.validDuring).toBeDefined();

    // The range should include both timestamps
    const rangeStr = historyRecord.validDuring as unknown as string;
    expect(rangeStr).toBeDefined();
    expect(typeof rangeStr).toBe('string');
    // Basic validation that it looks like a range
    expect(rangeStr).toMatch(/^\[.*,.*\)$/);
  });

  it('should capture lastEditedByProfileId in history', async () => {
    // Create process
    const process = await createProcess({
      data: {
        name: 'Test Process',
        description: 'Test',
        processSchema: {
          name: 'Test Process',
          description: 'Test',
          states: [
            {
              id: 'draft',
              name: 'Draft',
              type: 'initial',
              config: { allowProposals: true, allowDecisions: false },
            },
          ],
          phases: [{id: "phase1", name: "Phase 1", states: ["draft"]}], transitions: [],
          initialState: 'draft',
          decisionDefinition: {
            type: 'object',
            properties: { approved: { type: 'boolean' } },
            required: ['approved'],
          },
          proposalTemplate: {
            type: 'object',
            properties: {
              title: { type: 'string', minLength: 3 },
            },
            required: ['title'],
          },
        },
      },
      user: testUser,
    });

    const instance = await createInstance({
      data: {
        processId: process.id,
        name: 'Test Instance',
        description: 'Test',
        instanceData: {
          currentStateId: 'draft',
          fieldValues: {},
          phases: [
            {
              stateId: 'draft',
              plannedStartDate: new Date().toISOString(),
              plannedEndDate: new Date(Date.now() + 86400000).toISOString(),
            },
          ],
        },
      },
      user: testUser,
    });

    const proposal = await createProposal({
      data: {
        processInstanceId: instance.id,
        proposalData: { title: 'Original' },
        authUserId: testUser.id,
      },
      authUserId: testUser.id,
    });

    // Get the user's profile ID
    const dbUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.authUserId, testUser.id),
    });

    expect(dbUser).toBeDefined();

    // Update
    await new Promise((resolve) => setTimeout(resolve, 100));
    await updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: { title: 'Updated' },
      },
      user: testUser,
    });

    // Verify history has lastEditedByProfileId
    const historyRecords = await db.query.proposalHistory.findMany({
      where: eq(proposalHistory.id, proposal.id),
    });

    expect(historyRecords).toHaveLength(1);
    expect(historyRecords[0]!.lastEditedByProfileId).toBe(
      dbUser!.currentProfileId,
    );
  });
});
