import { TestDecisionsDataManager } from '@op/common/testing';
import {
  createDecisionBoundary,
  ensureProposalCategoryTerms,
} from '@op/common/testing/data';
import { db, inArray } from '@op/db/client';
import { ProcessStatus, ProposalStatus, taxonomyTerms } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { hashAttestation } from '../attestationHash';
import { affirmVoterAttestation, resolveVoterAddress } from '../voterEnrolment';
import { getSmsDecisionDescription } from './getSmsDecisionDescription';

describe.concurrent('getSmsDecisionDescription', () => {
  it('given a published decision with one submitted proposal, when a member asks for it by slug, then they get its name, phase, voting state and ballot count', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
    });
    await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: `Fund the park ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    await expect(
      getSmsDecisionDescription({
        authUserId: setup.user.id,
        decisionSlug: setup.instance.slug,
      }),
    ).resolves.toEqual({
      name: setup.instance.instance.name,
      phaseName: 'Initial Phase',
      votingOpen: false,
      proposalCount: 1,
    });
  });

  it('given a decision that is not published, when a member asks for it by slug, then it is not found', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.DRAFT,
    });

    await expect(
      getSmsDecisionDescription({
        authUserId: setup.user.id,
        decisionSlug: setup.instance.slug,
      }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('given a published decision the caller is not a member of, when they ask for it by slug, then the lookup is refused', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const outsider = await testData.createMemberUser({
      organization: setup.organization,
    });

    await expect(
      getSmsDecisionDescription({
        authUserId: outsider.authUserId,
        decisionSlug: setup.instance.slug,
      }),
    ).rejects.toMatchObject({ name: 'UnauthorizedError' });
  });
});

describe.concurrent('getSmsDecisionDescription for an enrolled voter', () => {
  it('given a voter enrolled in District 5 and a ballot of two District 5 proposals and one District 7 proposal, when they ask for the decision, then the count is their district ballot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: {
        id: 'district-show',
        version: '1.0.0',
        name: 'District show',
        description: 'A voting phase with enrolment by district',
        phases: [
          {
            id: 'voting',
            name: 'Voting',
            rules: {
              proposals: { submit: true },
              voting: {
                submit: true,
                enrolment: { attestation: 'I affirm.', boundary: true },
              },
            },
          },
        ],
      },
    });
    const instanceId = setup.instance.instance.id;
    const instanceProfileId = setup.instance.instance.profileId!;
    const five = `District 5 ${task.id}`;
    const seven = `District 7 ${task.id}`;
    const [termFive, termSeven] = await ensureProposalCategoryTerms([
      five,
      seven,
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
    await createDecisionBoundary({
      profileId: instanceProfileId,
      name: five,
      taxonomyTermId: termFive!.taxonomyTermId,
    });
    await createDecisionBoundary({
      profileId: instanceProfileId,
      name: seven,
      taxonomyTermId: termSeven!.taxonomyTermId,
      ring: [
        [10, 10],
        [11, 10],
        [11, 11],
        [10, 11],
        [10, 10],
      ],
    });
    for (const [title, location] of [
      ['Crosswalk lighting', { lat: 40.5, lng: -73.5 }],
      ['Tree planting', { lat: 40.5, lng: -73.5 }],
      ['Rec center hours', { lat: 10.5, lng: 10.5 }],
    ] as const) {
      await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title, location },
        status: ProposalStatus.SUBMITTED,
      });
    }
    const key = { processInstanceId: instanceId, authUserId: setup.user.id };
    await resolveVoterAddress({
      ...key,
      address: 'inside district five',
      geocode: async () => [{ lat: 40.5, lng: -73.5 }],
    });
    await affirmVoterAttestation({
      ...key,
      attestationHash: hashAttestation('I affirm.'),
    });

    await expect(
      getSmsDecisionDescription({
        authUserId: setup.user.id,
        decisionSlug: setup.instance.slug,
      }),
    ).resolves.toMatchObject({ votingOpen: true, proposalCount: 2 });
  });
});
