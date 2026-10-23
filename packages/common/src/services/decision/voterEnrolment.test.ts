import { TestDecisionsDataManager } from '@op/common/testing';
import { createDecisionBoundary } from '@op/common/testing/data';
import { db, eq } from '@op/db/client';
import {
  DecisionVoterEnrolmentStatus,
  ProcessStatus,
  processInstances,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { hashAttestation } from './attestationHash';
import type { DecisionSchemaDefinition } from './schemas/types';
import { updateDecisionInstance } from './updateDecisionInstance';
import {
  type Geocode,
  affirmVoterAttestation,
  findVoterEnrolment,
  isEnrolledOnCurrentAttestation,
  resolveVoterAddress,
  startVoterEnrolment,
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
      attestationHash: hashAttestation(ATTESTATION),
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

    const affirmed = await affirmVoterAttestation({
      processInstanceId: instanceId,
      authUserId,
      attestationHash: hashAttestation(ATTESTATION),
    });

    expect(affirmed).toMatchObject({
      status: 'enrolled',
      enrolment: {
        status: DecisionVoterEnrolmentStatus.ENROLLED,
        attestationHash: hashAttestation(ATTESTATION),
      },
    });
    expect(
      affirmed.status === 'enrolled' ? affirmed.enrolment.attestedAt : null,
    ).not.toBeNull();
  });

  it('given the attestation text changed after it was sent, planted by rewriting the phase rule, when the voter affirms, then they are not enrolled, the new text is recorded as sent, and affirming it enrols', async ({
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
      findVoterEnrolment({ processInstanceId: instanceId, authUserId }),
    ).resolves.toMatchObject({ attestationHash: hashAttestation(ATTESTATION) });
    const instance = await db.query.processInstances.findFirst({
      where: { id: instanceId },
      columns: { instanceData: true },
    });
    const rewritten = JSON.parse(
      JSON.stringify(instance!.instanceData).replaceAll(
        ATTESTATION,
        'New words.',
      ),
    );
    await db
      .update(processInstances)
      .set({ instanceData: rewritten })
      .where(eq(processInstances.id, instanceId));

    await expect(
      affirmVoterAttestation({
        processInstanceId: instanceId,
        authUserId,
        attestationHash: hashAttestation('New words.'),
      }),
    ).resolves.toEqual({ status: 'attestation_changed' });
    await expect(
      findVoterEnrolment({ processInstanceId: instanceId, authUserId }),
    ).resolves.toMatchObject({
      status: DecisionVoterEnrolmentStatus.AWAITING_AGREE,
      attestationHash: hashAttestation('New words.'),
    });
    await expect(
      affirmVoterAttestation({
        processInstanceId: instanceId,
        authUserId,
        attestationHash: hashAttestation('New words.'),
      }),
    ).resolves.toMatchObject({ status: 'enrolled' });
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

describe.concurrent('a rewritten attestation', () => {
  const rewrite = (
    setup: { user: Parameters<typeof updateDecisionInstance>[0]['user'] },
    instanceId: string,
    attestation: string,
  ) =>
    updateDecisionInstance({
      instanceId,
      phases: [
        {
          phaseId: 'voting',
          rules: { voting: { submit: true, enrolment: { attestation } } },
        },
      ],
      user: setup.user,
    });

  it('given an enrolled voter, when an admin rewrites the attestation, then the voter no longer counts as enrolled on the current words', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, authUserId } = await seedVotingDecision(
      testData,
      {
        boundary: false,
        withBoundaries: false,
        label: task.id,
      },
    );
    const key = { processInstanceId: instanceId, authUserId };
    await resolveVoterAddress({
      ...key,
      address: 'anywhere',
      geocode: geocodeTo([INSIDE]),
    });
    await affirmVoterAttestation({
      ...key,
      attestationHash: hashAttestation(ATTESTATION),
    });
    const rewritten = `New words ${task.id}.`;

    await rewrite(setup, instanceId, rewritten);

    const row = await findVoterEnrolment(key);
    expect(isEnrolledOnCurrentAttestation(row, ATTESTATION)).toBe(true);
    expect(isEnrolledOnCurrentAttestation(row, rewritten)).toBe(false);
  });

  it('given an enrolled voter whose attestation was rewritten, when they start again, then the row waits for the new affirmation, keeps its district, and affirming the new words enrols them again', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, authUserId } = await seedVotingDecision(
      testData,
      {
        boundary: true,
        withBoundaries: true,
        label: task.id,
      },
    );
    const key = { processInstanceId: instanceId, authUserId };
    await resolveVoterAddress({
      ...key,
      address: 'anywhere',
      geocode: geocodeTo([INSIDE]),
    });
    const first = await affirmVoterAttestation({
      ...key,
      attestationHash: hashAttestation(ATTESTATION),
    });
    const rewritten = `New words ${task.id}.`;
    await rewrite(setup, instanceId, rewritten);

    const reopened = await startVoterEnrolment(key);

    expect(reopened).toMatchObject({
      status: DecisionVoterEnrolmentStatus.AWAITING_AGREE,
      boundaryId: first.boundaryId,
    });
    await expect(
      affirmVoterAttestation({
        ...key,
        attestationHash: hashAttestation(ATTESTATION),
      }),
    ).rejects.toMatchObject({ name: 'ValidationError' });
    const enrolled = await affirmVoterAttestation({
      ...key,
      attestationHash: hashAttestation(rewritten),
    });
    expect(enrolled).toMatchObject({
      status: DecisionVoterEnrolmentStatus.ENROLLED,
      attestationHash: hashAttestation(rewritten),
      boundaryId: first.boundaryId,
    });
    expect(enrolled.attestedAt?.getTime()).toBeGreaterThan(
      first.attestedAt!.getTime(),
    );
  });

  it('given an enrolled voter whose attestation is unchanged, when they start again, then the row stays enrolled', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, authUserId } = await seedVotingDecision(testData, {
      boundary: false,
      withBoundaries: false,
      label: task.id,
    });
    const key = { processInstanceId: instanceId, authUserId };
    await resolveVoterAddress({
      ...key,
      address: 'anywhere',
      geocode: geocodeTo([INSIDE]),
    });
    await affirmVoterAttestation({
      ...key,
      attestationHash: hashAttestation(ATTESTATION),
    });

    await expect(startVoterEnrolment(key)).resolves.toMatchObject({
      status: DecisionVoterEnrolmentStatus.ENROLLED,
    });
  });
});
