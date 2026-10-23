import { TestDecisionsDataManager } from '@op/common/testing';
import { createDecisionBoundary } from '@op/common/testing/data';
import { DecisionVoterEnrolmentStatus, ProcessStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { hashAttestation } from './attestationHash';
import type { DecisionSchemaDefinition } from './schemas/types';
import {
  type Geocode,
  affirmVoterAttestation,
  findVoterEnrolment,
  resolveVoterAddress,
} from './voterEnrolment';

const ATTESTATION = 'I affirm that I meet the eligibility requirements.';

const INSIDE = { lat: 40.5, lng: -73.5 };
const OUTSIDE = { lat: 10, lng: 10 };

const geocodeTo =
  (points: ReadonlyArray<{ lat: number; lng: number }>): Geocode =>
  async () =>
    points.map((point) => ({ ...point, address: 'a formatted address' }));

const enrolmentSchema = (boundary: boolean): DecisionSchemaDefinition => ({
  id: 'voter-enrolment',
  version: '1.0.0',
  name: 'Voter enrolment',
  description: 'A voting phase that requires enrolment',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: { proposals: { submit: true }, voting: { submit: false } },
    },
    {
      id: 'voting',
      name: 'Voting',
      rules: {
        proposals: { submit: false },
        voting: {
          submit: true,
          enrolment: { attestation: ATTESTATION, boundary },
        },
      },
    },
  ],
});

const seedVotingDecision = async (
  testData: TestDecisionsDataManager,
  {
    boundary,
    withBoundaries,
    label,
  }: { boundary: boolean; withBoundaries: boolean; label: string },
) => {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    status: ProcessStatus.PUBLISHED,
    processSchema: enrolmentSchema(boundary),
  });
  const instanceId = setup.instance.instance.id;
  const instanceProfileId = setup.instance.instance.profileId;
  if (!instanceProfileId) {
    throw new Error('Instance has no profile');
  }
  const district = withBoundaries
    ? await createDecisionBoundary({
        profileId: instanceProfileId,
        name: `District 5 ${label}`,
      })
    : null;
  await testData.advancePhase({
    instanceId,
    fromPhaseId: 'submission',
    toPhaseId: 'voting',
  });
  return { setup, instanceId, authUserId: setup.user.id, district };
};

describe.concurrent('resolveVoterAddress', () => {
  it('given a decision that requires a district, when the address geocodes inside a boundary, then the row waits for the attestation with that boundary', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, authUserId, district } = await seedVotingDecision(
      testData,
      { boundary: true, withBoundaries: true, label: task.id },
    );

    const result = await resolveVoterAddress({
      processInstanceId: instanceId,
      authUserId,
      address: '375 S High St, Columbus, OH 43215',
      geocode: geocodeTo([INSIDE]),
    });

    expect(result).toEqual({
      status: 'resolved',
      boundary: { id: district!.id, name: district!.name },
    });
    const row = await findVoterEnrolment({
      processInstanceId: instanceId,
      authUserId,
    });
    expect(row).toMatchObject({
      status: DecisionVoterEnrolmentStatus.AWAITING_AGREE,
      boundaryId: district!.id,
      attestationHash: null,
    });
  });

  it('given the address geocodes to nothing, then the result says so and the row still waits for an address', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, authUserId } = await seedVotingDecision(testData, {
      boundary: true,
      withBoundaries: true,
      label: task.id,
    });

    const result = await resolveVoterAddress({
      processInstanceId: instanceId,
      authUserId,
      address: 'nowhere at all',
      geocode: geocodeTo([]),
    });

    expect(result).toEqual({ status: 'not_found' });
    await expect(
      findVoterEnrolment({ processInstanceId: instanceId, authUserId }),
    ).resolves.toMatchObject({
      status: DecisionVoterEnrolmentStatus.AWAITING_ADDRESS,
      boundaryId: null,
    });
  });

  it('given a decision that requires a district, when the address falls outside every boundary, then the result says so and the row still waits for an address', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, authUserId } = await seedVotingDecision(testData, {
      boundary: true,
      withBoundaries: true,
      label: task.id,
    });

    const result = await resolveVoterAddress({
      processInstanceId: instanceId,
      authUserId,
      address: 'far away',
      geocode: geocodeTo([OUTSIDE]),
    });

    expect(result).toEqual({ status: 'outside' });
    await expect(
      findVoterEnrolment({ processInstanceId: instanceId, authUserId }),
    ).resolves.toMatchObject({
      status: DecisionVoterEnrolmentStatus.AWAITING_ADDRESS,
      boundaryId: null,
    });
  });

  it('given a decision that requires a district but has imported no boundaries, when the address is found, then the voter is enrolled with no district', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, authUserId } = await seedVotingDecision(testData, {
      boundary: true,
      withBoundaries: false,
      label: task.id,
    });

    const result = await resolveVoterAddress({
      processInstanceId: instanceId,
      authUserId,
      address: 'far away',
      geocode: geocodeTo([OUTSIDE]),
    });

    expect(result).toEqual({ status: 'resolved', boundary: null });
    await expect(
      findVoterEnrolment({ processInstanceId: instanceId, authUserId }),
    ).resolves.toMatchObject({
      status: DecisionVoterEnrolmentStatus.AWAITING_AGREE,
      boundaryId: null,
    });
  });

  it('given a decision that does not require a district, when the address falls outside every boundary, then the voter still moves on to the attestation', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, authUserId } = await seedVotingDecision(testData, {
      boundary: false,
      withBoundaries: true,
      label: task.id,
    });

    const result = await resolveVoterAddress({
      processInstanceId: instanceId,
      authUserId,
      address: 'far away',
      geocode: geocodeTo([OUTSIDE]),
    });

    expect(result).toEqual({ status: 'resolved', boundary: null });
  });
});

describe.concurrent('affirmVoterAttestation', () => {
  it('given the voter has given an address, when they affirm the attestation that was sent, then the row is enrolled with the hash and the time', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, authUserId } = await seedVotingDecision(testData, {
      boundary: false,
      withBoundaries: false,
      label: task.id,
    });
    await resolveVoterAddress({
      processInstanceId: instanceId,
      authUserId,
      address: 'anywhere',
      geocode: geocodeTo([INSIDE]),
    });

    const enrolled = await affirmVoterAttestation({
      processInstanceId: instanceId,
      authUserId,
      attestationHash: hashAttestation(ATTESTATION),
    });

    expect(enrolled).toMatchObject({
      status: DecisionVoterEnrolmentStatus.ENROLLED,
      attestationHash: hashAttestation(ATTESTATION),
    });
    expect(enrolled.attestedAt).not.toBeNull();
  });

  it('given a hash of different words, when the voter affirms, then the affirmation is refused and the row still waits for it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, authUserId } = await seedVotingDecision(testData, {
      boundary: false,
      withBoundaries: false,
      label: task.id,
    });
    await resolveVoterAddress({
      processInstanceId: instanceId,
      authUserId,
      address: 'anywhere',
      geocode: geocodeTo([INSIDE]),
    });

    await expect(
      affirmVoterAttestation({
        processInstanceId: instanceId,
        authUserId,
        attestationHash: hashAttestation('Other words.'),
      }),
    ).rejects.toMatchObject({ name: 'ValidationError' });
    await expect(
      findVoterEnrolment({ processInstanceId: instanceId, authUserId }),
    ).resolves.toMatchObject({
      status: DecisionVoterEnrolmentStatus.AWAITING_AGREE,
      attestationHash: null,
    });
  });

  it('given the voter has not given an address yet, when they affirm, then the affirmation is refused', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, authUserId } = await seedVotingDecision(testData, {
      boundary: false,
      withBoundaries: false,
      label: task.id,
    });

    await expect(
      affirmVoterAttestation({
        processInstanceId: instanceId,
        authUserId,
        attestationHash: hashAttestation(ATTESTATION),
      }),
    ).rejects.toMatchObject({ name: 'ValidationError' });
  });

  it('given a decision with no enrolment rule, when an address is offered, then the service refuses because there is no step to take', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
    });

    await expect(
      resolveVoterAddress({
        processInstanceId: setup.instance.instance.id,
        authUserId: setup.user.id,
        address: 'anywhere',
        geocode: geocodeTo([INSIDE]),
      }),
    ).rejects.toMatchObject({ name: 'ValidationError' });
    await expect(
      findVoterEnrolment({
        processInstanceId: setup.instance.instance.id,
        authUserId: setup.user.id,
      }),
    ).resolves.toBeNull();
  });
});
