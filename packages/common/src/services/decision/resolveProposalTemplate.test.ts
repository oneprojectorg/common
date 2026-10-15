import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { decisionProcesses } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { resolveProposalTemplate } from './resolveProposalTemplate';

const proposalTemplate = {
  fields: [{ id: 'title', type: 'text', label: 'Title' }],
};

describe.concurrent('resolveProposalTemplate', () => {
  it('keeps the instance and its snapshot when the template is deleted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { process, instance } = await testData.createDecisionSetup({
      instanceCount: 1,
      proposalTemplate,
    });

    await db
      .delete(decisionProcesses)
      .where(eq(decisionProcesses.id, process.id));

    const orphan = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    expect(orphan).toBeDefined();
    expect(orphan?.processId).toBeNull();
    expect(orphan?.instanceData).toMatchObject({ proposalTemplate });

    await expect(
      resolveProposalTemplate(
        orphan?.instanceData ?? null,
        orphan?.processId ?? null,
      ),
    ).resolves.toEqual(proposalTemplate);
  });

  it('falls back to the template schema while the template exists', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { process } = await testData.createDecisionSetup({
      proposalTemplate,
    });

    await expect(resolveProposalTemplate({}, process.id)).resolves.toEqual(
      proposalTemplate,
    );
  });

  it('has no template-level fallback without a template', async () => {
    await expect(resolveProposalTemplate({}, null)).resolves.toBeNull();
  });
});
