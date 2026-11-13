import { mockCollab } from '@op/collab/testing';
import {
  TestDecisionsDataManager,
  schemaWithRankedBudgetPipeline,
} from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { ProcessStatus, ProposalStatus, proposals } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../utils';
import { getPhaseProposalCosts } from './getPhaseProposalCosts';
import { parseProposalData } from './proposalDataSchema';
import type { DecisionSchemaDefinition } from './schemas/types';

const schemaWithUnpricedBudget: DecisionSchemaDefinition = {
  ...schemaWithRankedBudgetPipeline,
  id: 'ranked-budget-unpriced-schema',
  proposalTemplate: {
    type: 'object',
    properties: {
      title: { type: 'string', 'x-format': 'short-text' },
      budget: { type: 'string', 'x-format': 'short-text' },
    },
  },
};

async function seedInstance(
  testData: TestDecisionsDataManager,
  processSchema: DecisionSchemaDefinition,
) {
  const setup = await testData.createDecisionSetup({
    processSchema,
    instanceCount: 1,
    grantAccess: true,
    status: ProcessStatus.PUBLISHED,
  });
  const { instance } = setup.instance;
  const votingPhase = instance.instanceData.phases.find(
    (phase) => phase.phaseId === 'voting',
  );
  if (!votingPhase) {
    throw new Error('Fixture has no voting phase');
  }

  return { setup, instance, votingPhase };
}

describe.concurrent('getPhaseProposalCosts', () => {
  it('prices the phase proposals from their live documents', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, votingPhase } = await seedInstance(
      testData,
      schemaWithRankedBudgetPipeline,
    );
    const created = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.id,
      proposalData: {
        title: `Priced ${task.id}`,
        budget: { amount: 1, currency: 'USD' },
      },
      status: ProposalStatus.SUBMITTED,
    });
    const { collaborationDocId } = parseProposalData(created.proposalData);
    if (!collaborationDocId) {
      throw new Error('Proposal has no collaboration document');
    }
    // The document, not the stale snapshot, is what gets priced.
    mockCollab.setDocFragments(collaborationDocId, {
      title: `Priced ${task.id}`,
      budget: JSON.stringify({ amount: 250, currency: 'USD' }),
    });
    const [row] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, created.id));
    if (!row) {
      throw new Error('Proposal row missing');
    }

    const costs = await getPhaseProposalCosts({
      instanceData: instance.instanceData,
      processId: instance.processId,
      phase: votingPhase,
      proposals: [row],
    });

    expect([...costs]).toEqual([[created.id, 250]]);
  });

  it('rejects a phase whose cost field is not priced by the template', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instance, votingPhase } = await seedInstance(
      testData,
      schemaWithUnpricedBudget,
    );

    await expect(
      getPhaseProposalCosts({
        instanceData: instance.instanceData,
        processId: instance.processId,
        phase: votingPhase,
        proposals: [],
      }),
    ).rejects.toThrow(ValidationError);
  });
});
