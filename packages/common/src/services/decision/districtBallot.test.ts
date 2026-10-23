import { mockCollab, textFragment } from '@op/collab/testing';
import { TestDecisionsDataManager } from '@op/common/testing';
import {
  createDecisionBoundary,
  ensureProposalCategoryTerms,
} from '@op/common/testing/data';
import { db, inArray } from '@op/db/client';
import { ProcessStatus, taxonomyTerms } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { countBallotProposals } from './countBallotProposals';
import { getBallotProposalByCode } from './getBallotProposalByCode';
import { listBallotProposals } from './listBallotProposals';
import type { DecisionSchemaDefinition } from './schemas/types';
import { submitProposal } from './submitProposal';

const votingSchema: DecisionSchemaDefinition = {
  id: 'district-ballot',
  version: '1.0.0',
  name: 'District ballot',
  description: 'A voting phase whose ballot is scoped by district',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: { proposals: { submit: true }, voting: { submit: false } },
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'all', type: 'limit', count: 10 }],
      },
    },
    {
      id: 'voting',
      name: 'Voting',
      rules: { proposals: { submit: false }, voting: { submit: true } },
    },
  ],
};

const proposalTemplate = {
  type: 'object',
  required: ['title'],
  'x-field-order': ['title', 'summary'],
  properties: {
    title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
    summary: { type: 'string', title: 'Summary', 'x-format': 'long-text' },
  },
};

const readInstance = async (instanceId: string) => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: {
      id: true,
      instanceData: true,
      currentStateId: true,
      processId: true,
    },
  });
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }
  return instance;
};

const INSIDE_FIVE = { lat: 40.5, lng: -73.5 };
const INSIDE_SEVEN = { lat: 10.5, lng: 10.5 };

const seedDistrictDecision = async (
  testData: TestDecisionsDataManager,
  label: string,
  onTestFinished: (fn: () => Promise<void>) => void,
) => {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    status: ProcessStatus.PUBLISHED,
    processSchema: votingSchema,
    proposalTemplate,
  });
  const instanceId = setup.instance.instance.id;
  const instanceProfileId = setup.instance.instance.profileId;
  if (!instanceProfileId) {
    throw new Error('Instance has no profile');
  }
  const districts = {
    five: `District 5 ${label}`,
    seven: `District 7 ${label}`,
  };
  const [termFive, termSeven] = await ensureProposalCategoryTerms([
    districts.five,
    districts.seven,
  ]);
  onTestFinished(async () => {
    await db
      .delete(taxonomyTerms)
      .where(
        inArray(taxonomyTerms.id, [
          termFive!.taxonomyTermId,
          termSeven!.taxonomyTermId,
        ]),
      );
  });
  const five = await createDecisionBoundary({
    profileId: instanceProfileId,
    name: districts.five,
    taxonomyTermId: termFive!.taxonomyTermId,
  });
  const seven = await createDecisionBoundary({
    profileId: instanceProfileId,
    name: districts.seven,
    taxonomyTermId: termSeven!.taxonomyTermId,
    ring: [
      [10, 10],
      [11, 10],
      [11, 11],
      [10, 11],
      [10, 10],
    ],
  });
  const unlinked = await createDecisionBoundary({
    profileId: instanceProfileId,
    name: `Unlinked ${label}`,
    ring: [
      [20, 20],
      [21, 20],
      [21, 21],
      [20, 21],
      [20, 20],
    ],
  });

  const submit = async (
    title: string,
    location: { lat: number; lng: number },
  ) => {
    const draft = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title, location },
    });
    const { collaborationDocId } = draft.proposalData as {
      collaborationDocId: string;
    };
    mockCollab.setDocFragmentResponses(collaborationDocId, {
      title: textFragment(title),
    });
    return submitProposal({
      data: { proposalId: draft.id },
      authUserId: setup.user.id,
    });
  };
  const lighting = await submit('Crosswalk lighting', INSIDE_FIVE);
  const trees = await submit('Tree planting', INSIDE_FIVE);
  const rec = await submit('Rec center hours', INSIDE_SEVEN);
  await testData.advancePhase({
    instanceId,
    fromPhaseId: 'submission',
    toPhaseId: 'voting',
  });

  return {
    setup,
    instance: await readInstance(instanceId),
    boundaries: { five, seven, unlinked },
    proposals: { lighting, trees, rec },
  };
};

describe.concurrent('the district-scoped ballot', () => {
  it('given two District 5 proposals and one District 7 proposal, when the ballot is listed for the District 5 boundary, then only the District 5 proposals are on it and the count agrees', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instance, boundaries } = await seedDistrictDecision(
      testData,
      task.id,
      onTestFinished,
    );

    const page = await listBallotProposals({
      instance,
      boundaryId: boundaries.five.id,
      limit: 10,
    });
    const count = await countBallotProposals({
      instance,
      boundaryId: boundaries.five.id,
    });

    expect(page.items.map(({ title }) => title)).toEqual([
      'Crosswalk lighting',
      'Tree planting',
    ]);
    expect(count).toBe(2);
  });

  it('given no boundary, when the ballot is listed, then every proposal is on it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instance } = await seedDistrictDecision(
      testData,
      task.id,
      onTestFinished,
    );

    const page = await listBallotProposals({ instance, limit: 10 });

    expect(page.items).toHaveLength(3);
    await expect(countBallotProposals({ instance })).resolves.toBe(3);
  });

  it('given a boundary with no linked category, when the ballot is listed for it, then it is not narrowed because no proposal can carry that district', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instance, boundaries } = await seedDistrictDecision(
      testData,
      task.id,
      onTestFinished,
    );

    await expect(
      countBallotProposals({ instance, boundaryId: boundaries.unlinked.id }),
    ).resolves.toBe(3);
  });

  it('given a District 7 proposal, when its code is looked up for the District 5 boundary, then nothing comes back', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instance, boundaries, proposals } = await seedDistrictDecision(
      testData,
      task.id,
      onTestFinished,
    );

    await expect(
      getBallotProposalByCode({
        instance,
        boundaryId: boundaries.five.id,
        code: proposals.rec.shortCode!,
      }),
    ).resolves.toBeNull();
    await expect(
      getBallotProposalByCode({
        instance,
        boundaryId: boundaries.five.id,
        code: proposals.lighting.shortCode!,
      }),
    ).resolves.toMatchObject({ title: 'Crosswalk lighting' });
  });
});
