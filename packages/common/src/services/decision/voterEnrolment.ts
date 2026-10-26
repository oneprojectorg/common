import { and, db, eq, sql } from '@op/db/client';
import {
  type DecisionVoterEnrolment,
  DecisionVoterEnrolmentStatus,
  decisionVoterEnrolments,
} from '@op/db/schema';

import { NotFoundError, ValidationError } from '../../utils';
import { getIndividualProfileId } from '../access';
import { hashAttestation } from './attestationHash';
import { forwardGeocode } from './forwardGeocode';
import { hasDecisionBoundaries, resolveBoundary } from './resolveBoundary';
import { getInstancePhases } from './schemas/instanceData';
import { getInstanceCurrentPhase } from './utils/instance';
import { getVoterEnrolment } from './utils/phaseSettings';

export type Geocode = (
  address: string,
) => Promise<ReadonlyArray<{ lat: number; lng: number }>>;

export type AddressResolution =
  | { status: 'resolved'; boundary: { id: string; name: string } | null }
  | { status: 'not_found' }
  | { status: 'outside' };

interface EnrolmentKey {
  processInstanceId: string;
  authUserId: string;
}

const defaultGeocode: Geocode = (address) => forwardGeocode({ query: address });

const loadEnrolmentContext = async ({
  processInstanceId,
  authUserId,
}: EnrolmentKey) => {
  const [profileId, instance] = await Promise.all([
    getIndividualProfileId(authUserId),
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
      columns: {
        id: true,
        profileId: true,
        instanceData: true,
        currentStateId: true,
      },
    }),
  ]);

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  const phase = getInstanceCurrentPhase({
    currentStateId: instance.currentStateId,
    instanceData: { phases: getInstancePhases(instance.instanceData) },
  });
  const rule = phase ? getVoterEnrolment(phase) : undefined;

  if (!rule) {
    throw new ValidationError('This decision has no enrolment step');
  }

  return { profileId, instance, rule };
};

const findRow = (processInstanceId: string, profileId: string) =>
  db.query.decisionVoterEnrolments.findFirst({
    where: { processInstanceId, profileId },
  });

const rowFilter = (processInstanceId: string, profileId: string) =>
  and(
    eq(decisionVoterEnrolments.processInstanceId, processInstanceId),
    eq(decisionVoterEnrolments.profileId, profileId),
  );

export const isEnrolledOnCurrentAttestation = (
  row: Pick<DecisionVoterEnrolment, 'status' | 'attestationHash'> | null,
  attestation: string,
): boolean =>
  row?.status === DecisionVoterEnrolmentStatus.ENROLLED &&
  row.attestationHash === hashAttestation(attestation);

export async function findVoterEnrolment({
  processInstanceId,
  authUserId,
}: EnrolmentKey): Promise<DecisionVoterEnrolment | null> {
  const profileId = await getIndividualProfileId(authUserId);
  return (await findRow(processInstanceId, profileId)) ?? null;
}

export async function startVoterEnrolment({
  processInstanceId,
  authUserId,
}: EnrolmentKey): Promise<DecisionVoterEnrolment> {
  const { profileId, rule } = await loadEnrolmentContext({
    processInstanceId,
    authUserId,
  });
  await db
    .insert(decisionVoterEnrolments)
    .values({ processInstanceId, profileId })
    .onConflictDoUpdate({
      target: [
        decisionVoterEnrolments.processInstanceId,
        decisionVoterEnrolments.profileId,
      ],
      set: { updatedAt: sql`(now() AT TIME ZONE 'utc'::text)` },
    });
  const row = await findRow(processInstanceId, profileId);

  if (!row) {
    throw new NotFoundError('Voter enrolment', processInstanceId);
  }

  if (
    row.status === DecisionVoterEnrolmentStatus.ENROLLED &&
    !isEnrolledOnCurrentAttestation(row, rule.attestation)
  ) {
    const [reopened] = await db
      .update(decisionVoterEnrolments)
      .set({ status: DecisionVoterEnrolmentStatus.AWAITING_AGREE })
      .where(rowFilter(processInstanceId, profileId))
      .returning();
    return reopened ?? row;
  }

  return row;
}

export async function resolveVoterAddress({
  processInstanceId,
  authUserId,
  address,
  attestation,
  geocode = defaultGeocode,
}: EnrolmentKey & {
  address: string;
  /** The attestation text the voter is sent with the result; defaults to the current rule. */
  attestation?: string;
  geocode?: Geocode;
}): Promise<AddressResolution> {
  const { profileId, instance, rule } = await loadEnrolmentContext({
    processInstanceId,
    authUserId,
  });
  const sentAttestation = attestation ?? rule.attestation;
  await db
    .insert(decisionVoterEnrolments)
    .values({ processInstanceId, profileId })
    .onConflictDoNothing();

  const [point] = await geocode(address);

  if (!point) {
    return { status: 'not_found' };
  }

  const boundariesConfigured = instance.profileId
    ? await hasDecisionBoundaries({ profileId: instance.profileId })
    : false;
  const boundary =
    boundariesConfigured && instance.profileId
      ? await resolveBoundary({
          lat: point.lat,
          lng: point.lng,
          profileId: instance.profileId,
        })
      : null;

  if (rule.boundary && boundariesConfigured && !boundary) {
    return { status: 'outside' };
  }

  await db
    .update(decisionVoterEnrolments)
    .set({
      status: DecisionVoterEnrolmentStatus.AWAITING_AGREE,
      boundaryId: boundary?.id ?? null,
      attestationHash: hashAttestation(sentAttestation),
    })
    .where(rowFilter(processInstanceId, profileId));

  return {
    status: 'resolved',
    boundary: boundary ? { id: boundary.id, name: boundary.name } : null,
  };
}

export type AttestationResult =
  | { status: 'enrolled'; enrolment: DecisionVoterEnrolment }
  | { status: 'attestation_changed' };

export async function markAttestationSent({
  processInstanceId,
  authUserId,
  attestation,
}: EnrolmentKey & {
  /** The attestation text that was sent; defaults to the current rule. */
  attestation?: string;
}): Promise<void> {
  const { profileId, rule } = await loadEnrolmentContext({
    processInstanceId,
    authUserId,
  });
  await db
    .update(decisionVoterEnrolments)
    .set({ attestationHash: hashAttestation(attestation ?? rule.attestation) })
    .where(
      and(
        rowFilter(processInstanceId, profileId),
        eq(
          decisionVoterEnrolments.status,
          DecisionVoterEnrolmentStatus.AWAITING_AGREE,
        ),
      ),
    );
}

export async function affirmVoterAttestation({
  processInstanceId,
  authUserId,
  attestationHash,
}: EnrolmentKey & {
  attestationHash: string;
}): Promise<AttestationResult> {
  const { profileId, rule } = await loadEnrolmentContext({
    processInstanceId,
    authUserId,
  });
  const row = await findRow(processInstanceId, profileId);

  if (!row || row.status === DecisionVoterEnrolmentStatus.AWAITING_ADDRESS) {
    throw new ValidationError('Give an address before affirming');
  }

  if (isEnrolledOnCurrentAttestation(row, rule.attestation)) {
    return { status: 'enrolled', enrolment: row };
  }

  if (attestationHash !== hashAttestation(rule.attestation)) {
    throw new ValidationError(
      'The affirmation does not match the current attestation',
    );
  }

  if (row.attestationHash !== attestationHash) {
    await db
      .update(decisionVoterEnrolments)
      .set({ attestationHash })
      .where(rowFilter(processInstanceId, profileId));
    return { status: 'attestation_changed' };
  }

  const [enrolled] = await db
    .update(decisionVoterEnrolments)
    .set({
      status: DecisionVoterEnrolmentStatus.ENROLLED,
      attestationHash,
      attestedAt: new Date(),
    })
    .where(rowFilter(processInstanceId, profileId))
    .returning();

  if (!enrolled) {
    throw new NotFoundError('Voter enrolment', processInstanceId);
  }

  return { status: 'enrolled', enrolment: enrolled };
}

export interface PendingVoterEnrolment {
  processInstanceId: string;
  status: DecisionVoterEnrolment['status'];
  boundaryName: string | null;
}

export async function findPendingVoterEnrolment({
  authUserId,
  processInstanceId,
}: {
  authUserId: string;
  /** Only this decision's pending row; otherwise the row the voter touched last. */
  processInstanceId?: string;
}): Promise<PendingVoterEnrolment | null> {
  const profileId = await getIndividualProfileId(authUserId);
  const rows = await db.query.decisionVoterEnrolments.findMany({
    where: {
      profileId,
      status: { ne: DecisionVoterEnrolmentStatus.ENROLLED },
      ...(processInstanceId ? { processInstanceId } : {}),
    },
    columns: { processInstanceId: true, status: true, updatedAt: true },
    with: { boundary: { columns: { name: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  const row = rows[0];

  return row
    ? {
        processInstanceId: row.processInstanceId,
        status: row.status,
        boundaryName: row.boundary?.name ?? null,
      }
    : null;
}
