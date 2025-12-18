import { db, eq } from '@op/db/client';
import {
  decisionProcesses,
  processInstances,
  profiles,
  proposalCategories,
  proposals,
  taxonomies,
  taxonomyTerms,
  users,
} from '@op/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { createInstance } from '../createInstance';
import { createProcess } from '../createProcess';
import { createProposal } from '../createProposal';
import { getProcessCategories } from '../getProcessCategories';
import { listProposals } from '../listProposals';

describe('Category Flow Integration Tests', () => {
  let testUser: any;
  let testProfile: any;

  beforeEach(async () => {
    // Clean up existing data
    await db.delete(proposalCategories);
    await db.delete(proposals);
    await db.delete(processInstances);
    await db.delete(decisionProcesses);
    await db.delete(taxonomyTerms);
    await db.delete(taxonomies);
    await db.delete(profiles);
    await db.delete(users);

    // Create a test user and profile
    const [user] = await db
      .insert(users)
      .values({
        authUserId: 'test-auth-user-id',
        email: 'test@example.com',
      })
      .returning();

    const [profile] = await db
      .insert(profiles)
      .values({
        name: 'Test User',
        slug: 'test-user',
        userId: user.id,
      })
      .returning();

    await db
      .update(users)
      .set({ currentProfileId: profile.id })
      .where(eq(users.id, user.id));

    testUser = { id: 'test-auth-user-id', email: 'test@example.com' };
    testProfile = profile;
  });

  it('should handle complete category flow: process creation → proposal creation → filtering', async () => {
    // Step 1: Create process with categories
    const processData = {
      name: 'Community Budget Process',
      description: 'A process for community budget allocation',
      processSchema: {
        name: 'Community Budget Process',
        fields: {
          categories: ['Infrastructure', 'Community Events', 'Education'],
          budgetCapAmount: 5000,
          descriptionGuidance: 'Please describe your proposal',
        },
        states: [
          {
            id: 'submission',
            name: 'Proposal Submission',
            type: 'initial' as const,
            config: { proposals: { submit: true }, voting: { submit: false } },
          },
        ],
        transitions: [],
        initialState: 'submission',
        decisionDefinition: {},
        proposalTemplate: {},
      },
    };

    const process = await createProcess({
      data: processData,
      user: testUser,
    });

    expect(process).toBeDefined();

    // Verify taxonomy and terms were created
    const proposalTaxonomy = await db.query.taxonomies.findFirst({
      where: eq(taxonomies.name, 'proposal'),
      with: { taxonomyTerms: true },
    });

    expect(proposalTaxonomy).toBeDefined();
    expect(proposalTaxonomy!.taxonomyTerms).toHaveLength(3);

    const termLabels = proposalTaxonomy!.taxonomyTerms.map((t) => t.label);
    expect(termLabels).toContain('Infrastructure');
    expect(termLabels).toContain('Community Events');
    expect(termLabels).toContain('Education');

    // Step 2: Create process instance
    const instanceData = {
      processId: process.id,
      name: 'Q1 2025 Community Budget',
      description: 'First quarter community budget allocation',
      instanceData: {
        budget: 50000,
        currentStateId: 'submission',
        fieldValues: {
          categories: ['Infrastructure', 'Community Events', 'Education'],
          budgetCapAmount: 5000,
          descriptionGuidance: 'Please describe your proposal',
        },
      },
    };

    const instance = await createInstance({
      data: instanceData,
      user: testUser,
    });

    expect(instance).toBeDefined();

    // Step 3: Test getProcessCategories
    const categories = await getProcessCategories({
      processInstanceId: instance.id,
      user: testUser,
    });

    expect(categories).toHaveLength(3);
    expect(categories.map((c) => c.name)).toContain('Infrastructure');
    expect(categories.map((c) => c.name)).toContain('Community Events');
    expect(categories.map((c) => c.name)).toContain('Education');

    // Get the Infrastructure category for testing
    const infrastructureCategory = categories.find(
      (c) => c.name === 'Infrastructure',
    )!;
    const educationCategory = categories.find((c) => c.name === 'Education')!;

    // Step 4: Create proposals with different categories
    const proposal1 = await createProposal({
      data: {
        processInstanceId: instance.id,
        proposalData: {
          title: 'Road Repairs',
          content: 'Fix potholes on Main Street',
          category: 'Infrastructure',
          budget: 3000,
        },
      },
      user: testUser,
    });

    const proposal2 = await createProposal({
      data: {
        processInstanceId: instance.id,
        proposalData: {
          title: 'School Supplies',
          content: 'Buy supplies for local school',
          category: 'Education',
          budget: 1500,
        },
      },
      user: testUser,
    });

    const proposal3 = await createProposal({
      data: {
        processInstanceId: instance.id,
        proposalData: {
          title: 'Another Road Project',
          content: 'Expand bicycle lanes',
          category: 'Infrastructure',
          budget: 4000,
        },
      },
      user: testUser,
    });

    expect(proposal1).toBeDefined();
    expect(proposal2).toBeDefined();
    expect(proposal3).toBeDefined();

    // Step 5: Verify proposals are linked to taxonomy terms
    const proposalCategoryLinks = await db.query.proposalCategories.findMany();
    expect(proposalCategoryLinks).toHaveLength(3); // One link per proposal

    // Step 6: Test filtering - should return all proposals (no filter)
    const allProposals = await listProposals({
      input: {
        processInstanceId: instance.id,
      },
      user: testUser,
    });

    expect(allProposals.proposals).toHaveLength(3);

    // Step 7: Test filtering by Infrastructure category
    const infrastructureProposals = await listProposals({
      input: {
        processInstanceId: instance.id,
        categoryId: infrastructureCategory.id,
      },
      user: testUser,
    });

    expect(infrastructureProposals.proposals).toHaveLength(2);
    const infrastructureTitles = infrastructureProposals.proposals.map(
      (p) => (p.proposalData as any).title,
    );
    expect(infrastructureTitles).toContain('Road Repairs');
    expect(infrastructureTitles).toContain('Another Road Project');

    // Step 8: Test filtering by Education category
    const educationProposals = await listProposals({
      input: {
        processInstanceId: instance.id,
        categoryId: educationCategory.id,
      },
      user: testUser,
    });

    expect(educationProposals.proposals).toHaveLength(1);
    expect((educationProposals.proposals[0].proposalData as any).title).toBe(
      'School Supplies',
    );

    // Step 9: Test filtering by non-existent category
    const communityEventsCategory = categories.find(
      (c) => c.name === 'Community Events',
    )!;
    const communityProposals = await listProposals({
      input: {
        processInstanceId: instance.id,
        categoryId: communityEventsCategory.id,
      },
      user: testUser,
    });

    expect(communityProposals.proposals).toHaveLength(0);
  });

  it('should handle proposals without categories', async () => {
    // Create process and instance
    const process = await createProcess({
      data: {
        name: 'Simple Process',
        processSchema: {
          name: 'Simple Process',
          fields: {
            categories: ['Test Category'],
          },
          states: [
            {
              id: 'submission',
              name: 'Submission',
              type: 'initial' as const,
              config: {
                proposals: { submit: true },
                voting: { submit: false },
              },
            },
          ],
          transitions: [],
          initialState: 'submission',
          decisionDefinition: {},
          proposalTemplate: {},
        },
      },
      user: testUser,
    });

    const instance = await createInstance({
      data: {
        processId: process.id,
        name: 'Test Instance',
        instanceData: {
          currentStateId: 'submission',
          fieldValues: { categories: ['Test Category'] },
        },
      },
      user: testUser,
    });

    // Create proposal without category
    const proposalWithoutCategory = await createProposal({
      data: {
        processInstanceId: instance.id,
        proposalData: {
          title: 'No Category Proposal',
          content: 'This proposal has no category',
          budget: 1000,
          // No category field
        },
      },
      user: testUser,
    });

    // Create proposal with empty category
    const proposalWithEmptyCategory = await createProposal({
      data: {
        processInstanceId: instance.id,
        proposalData: {
          title: 'Empty Category Proposal',
          content: 'This proposal has empty category',
          category: '', // Empty category
          budget: 1000,
        },
      },
      user: testUser,
    });

    // Both proposals should be created successfully
    expect(proposalWithoutCategory).toBeDefined();
    expect(proposalWithEmptyCategory).toBeDefined();

    // No proposal category links should be created
    const links = await db.query.proposalCategories.findMany();
    expect(links).toHaveLength(0);

    // Both proposals should appear when not filtering by category
    const allProposals = await listProposals({
      input: { processInstanceId: instance.id },
      user: testUser,
    });
    expect(allProposals.proposals).toHaveLength(2);
  });
});
