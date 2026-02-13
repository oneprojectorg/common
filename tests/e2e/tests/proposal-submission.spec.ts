import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

const MOCK_DOC_ID = 'test-submission-doc';

test.describe('Proposal Submission Validation', () => {
  test('prevents submission when required title is empty', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();

    // Schema requires title (required: ['title'])
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    // Create a draft proposal with an empty title
    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: {
        title: '',
        collaborationDocId: MOCK_DOC_ID,
      },
    });

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/edit`,
    );

    // Wait for the editor to load
    await expect(
      authenticatedPage.getByRole('button', { name: /Submit/i }),
    ).toBeVisible({ timeout: 30_000 });

    // Click submit without filling in the required title
    await authenticatedPage.getByRole('button', { name: /Submit/i }).click();

    // Should show a validation toast about the missing required title field
    await expect(
      authenticatedPage.getByText(
        'Please complete the following required fields:',
      ),
    ).toBeVisible({ timeout: 5_000 });
    await expect(authenticatedPage.getByText('Title')).toBeVisible();

    // Should NOT navigate away — still on the edit page
    await expect(authenticatedPage).toHaveURL(
      new RegExp(
        `/decisions/${instance.slug}/proposal/${proposal.profileId}/edit`,
      ),
    );
  });

  test('prevents submission when required budget is missing', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();

    // Schema that requires both title and budget
    const proposalTemplate = {
      type: 'object' as const,
      required: ['title', 'budget'],
      'x-field-order': ['title', 'budget'],
      properties: {
        title: {
          type: 'string' as const,
          title: 'Title',
          'x-format': 'short-text',
        },
        budget: {
          type: 'number' as const,
          title: 'Budget',
          'x-format': 'money',
          maximum: 50000,
        },
      },
    };

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
      proposalTemplate,
    });

    // Draft proposal with a title but no budget
    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: {
        title: 'Proposal Without Budget',
        collaborationDocId: MOCK_DOC_ID,
      },
    });

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/edit`,
    );

    await expect(
      authenticatedPage.getByRole('button', { name: /Submit/i }),
    ).toBeVisible({ timeout: 30_000 });

    await authenticatedPage.getByRole('button', { name: /Submit/i }).click();

    // Should show validation error mentioning Budget
    await expect(
      authenticatedPage.getByText(
        'Please complete the following required fields:',
      ),
    ).toBeVisible({ timeout: 5_000 });
    await expect(authenticatedPage.getByText('Budget')).toBeVisible();

    // Still on the edit page
    await expect(authenticatedPage).toHaveURL(
      new RegExp(
        `/decisions/${instance.slug}/proposal/${proposal.profileId}/edit`,
      ),
    );
  });

  test('prevents submission when required category is not selected', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();

    // Schema that requires title and category
    const proposalTemplate = {
      type: 'object' as const,
      required: ['title', 'category'],
      'x-field-order': ['title', 'category'],
      properties: {
        title: {
          type: 'string' as const,
          title: 'Title',
          'x-format': 'short-text',
        },
        category: {
          type: ['string', 'null'] as const,
          title: 'Category',
          'x-format': 'category',
          oneOf: [
            { const: 'infrastructure', title: 'Infrastructure' },
            { const: 'education', title: 'Education' },
            { const: 'health', title: 'Health' },
          ],
        },
      },
    };

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
      proposalTemplate,
    });

    // Draft proposal with title but no category
    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: {
        title: 'Proposal Without Category',
        collaborationDocId: MOCK_DOC_ID,
      },
    });

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/edit`,
    );

    await expect(
      authenticatedPage.getByRole('button', { name: /Submit/i }),
    ).toBeVisible({ timeout: 30_000 });

    await authenticatedPage.getByRole('button', { name: /Submit/i }).click();

    // Should show validation error mentioning Category
    await expect(
      authenticatedPage.getByText(
        'Please complete the following required fields:',
      ),
    ).toBeVisible({ timeout: 5_000 });
    await expect(authenticatedPage.getByText('Category')).toBeVisible();

    // Still on the edit page
    await expect(authenticatedPage).toHaveURL(
      new RegExp(
        `/decisions/${instance.slug}/proposal/${proposal.profileId}/edit`,
      ),
    );
  });
});
