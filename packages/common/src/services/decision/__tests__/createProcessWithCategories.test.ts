import { db, eq } from '@op/db/client';
import {
  decisionProcesses,
  profiles,
  taxonomies,
  taxonomyTerms,
  users,
} from '@op/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { createProcess } from '../createProcess';

describe('createProcess with categories', () => {
  let testUser: any;
  let testProfile: any;

  beforeEach(async () => {
    // Clean up existing data
    await db.delete(taxonomyTerms);
    await db.delete(taxonomies);
    await db.delete(decisionProcesses);
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

  it('should create proposal taxonomy and terms when process has categories', async () => {
    const processData = {
      name: 'Test Process',
      description: 'A test process with categories',
      processSchema: {
        name: 'Test Process',
        fields: {
          categories: ['Infrastructure', 'Community Events', 'Education'],
          budgetCapAmount: 1000,
          descriptionGuidance: 'Please describe your proposal',
        },
        states: [
          {
            id: 'submission',
            name: 'Proposal Submission',
            type: 'initial' as const,
            config: { allowProposals: true, allowDecisions: false },
          },
        ],
        transitions: [],
        initialState: 'submission',
        decisionDefinition: {},
        proposalTemplate: {},
      },
    };

    // Create the process
    const result = await createProcess({
      data: processData,
      user: testUser,
    });

    expect(result).toBeDefined();
    expect(result.name).toBe('Test Process');

    // Check that the "proposal" taxonomy was created
    const proposalTaxonomy = await db._query.taxonomies.findFirst({
      where: eq(taxonomies.name, 'proposal'),
    });

    expect(proposalTaxonomy).toBeDefined();
    expect(proposalTaxonomy!.name).toBe('proposal');
    expect(proposalTaxonomy!.description).toBe(
      'Categories for organizing proposals in decision-making processes',
    );

    // Check that taxonomy terms were created for each category
    const terms = await db._query.taxonomyTerms.findMany({
      where: eq(taxonomyTerms.taxonomyId, proposalTaxonomy!.id),
    });

    expect(terms).toHaveLength(3);

    const termsByUri = terms.reduce(
      (acc, term) => {
        acc[term.termUri] = term;
        return acc;
      },
      {} as Record<string, (typeof terms)[0]>,
    );

    expect(termsByUri['infrastructure']).toBeDefined();
    expect(termsByUri['infrastructure'].label).toBe('Infrastructure');
    expect(termsByUri['infrastructure'].definition).toBe(
      'Category for Infrastructure proposals',
    );

    expect(termsByUri['community-events']).toBeDefined();
    expect(termsByUri['community-events'].label).toBe('Community Events');
    expect(termsByUri['community-events'].definition).toBe(
      'Category for Community Events proposals',
    );

    expect(termsByUri['education']).toBeDefined();
    expect(termsByUri['education'].label).toBe('Education');
    expect(termsByUri['education'].definition).toBe(
      'Category for Education proposals',
    );
  });

  it('should handle duplicate categories gracefully', async () => {
    const processData1 = {
      name: 'Process 1',
      processSchema: {
        name: 'Process 1',
        fields: {
          categories: ['Infrastructure', 'Education'],
        },
        states: [
          {
            id: 'submission',
            name: 'Submission',
            type: 'initial' as const,
            config: { allowProposals: true, allowDecisions: false },
          },
        ],
        transitions: [],
        initialState: 'submission',
        decisionDefinition: {},
        proposalTemplate: {},
      },
    };

    const processData2 = {
      name: 'Process 2',
      processSchema: {
        name: 'Process 2',
        fields: {
          categories: ['Infrastructure', 'Community Events'], // Infrastructure is duplicate
        },
        states: [
          {
            id: 'submission',
            name: 'Submission',
            type: 'initial' as const,
            config: { allowProposals: true, allowDecisions: false },
          },
        ],
        transitions: [],
        initialState: 'submission',
        decisionDefinition: {},
        proposalTemplate: {},
      },
    };

    // Create first process
    await createProcess({ data: processData1, user: testUser });

    // Create second process with overlapping categories
    await createProcess({ data: processData2, user: testUser });

    // Check that we have the right number of unique terms
    const proposalTaxonomy = await db._query.taxonomies.findFirst({
      where: eq(taxonomies.name, 'proposal'),
    });

    const terms = await db._query.taxonomyTerms.findMany({
      where: eq(taxonomyTerms.taxonomyId, proposalTaxonomy!.id),
    });

    expect(terms).toHaveLength(3); // Infrastructure, Education, Community Events
  });

  it('should handle empty categories array', async () => {
    const processData = {
      name: 'Process without categories',
      processSchema: {
        name: 'Process',
        fields: {
          categories: [], // Empty categories
          budgetCapAmount: 1000,
        },
        states: [
          {
            id: 'submission',
            name: 'Submission',
            type: 'initial' as const,
            config: { allowProposals: true, allowDecisions: false },
          },
        ],
        transitions: [],
        initialState: 'submission',
        decisionDefinition: {},
        proposalTemplate: {},
      },
    };

    // Should not throw an error
    const result = await createProcess({ data: processData, user: testUser });
    expect(result).toBeDefined();

    // Should not create any taxonomy
    const proposalTaxonomy = await db._query.taxonomies.findFirst({
      where: eq(taxonomies.name, 'proposal'),
    });

    expect(proposalTaxonomy).toBeUndefined();
  });
});
