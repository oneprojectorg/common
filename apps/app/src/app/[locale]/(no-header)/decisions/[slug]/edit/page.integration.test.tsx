import { signInAs } from '@/testing/serverRequest';
import { TestDecisionsDataManager } from '@op/common/testing';
import { describe, expect, it, vi } from 'vitest';

import EditDecisionPage from './page';

vi.mock(
  'next/headers',
  async () => (await import('@/testing/serverRequest')).nextHeadersMock,
);

/** The error `forbidden()` throws; Next.js renders the route's `forbidden.tsx` for it. */
const FORBIDDEN_DIGEST = 'NEXT_HTTP_ERROR_FALLBACK;403';

const renderEditPage = (slug: string) =>
  EditDecisionPage({ params: Promise.resolve({ slug }) });

describe('EditDecisionPage', () => {
  it('shows the forbidden screen to a user who is not a member of the decision', async ({
    task,
    onTestFinished,
  }) => {
    // Given a decision and a confirmed user who has no access to it
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });
    const nonMember = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    await signInAs(nonMember.email);

    // When the non-member opens the edit page
    const result = renderEditPage(setup.instance.slug);

    // Then the page raises the forbidden interrupt, not a generic error
    await expect(result).rejects.toMatchObject({ digest: FORBIDDEN_DIGEST });
  });

  it('renders for a decision admin', async ({ task, onTestFinished }) => {
    // Given a decision and its admin
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    await signInAs(setup.userEmail);

    // When the admin opens the edit page
    const result = await renderEditPage(setup.instance.slug);

    // Then the page renders
    expect(result).toBeTruthy();
  });
});
