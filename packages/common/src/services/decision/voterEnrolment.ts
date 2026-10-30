import { and, db, eq } from '@op/db/client';
import {
  type DecisionVoterEnrolment,
  decisionVoterEnrolments,
} from '@op/db/schema';

import { NotFoundError, ValidationError } from '../../utils';
import { getIndividualProfileId } from '../access';
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

export const isVoterEnrolled = (
  row: Pick<DecisionVoterEnrolment, 'enrolledAt'> | null | undefined,
): boolean => row?.enrolledAt != null;

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
  const { profileId } = await loadEnrolmentContext({
    processInstanceId,
    authUserId,
  });
  await db
    .insert(decisionVoterEnrolments)
    .values({ processInstanceId, profileId })
    .onConflictDoNothing();
  const row = await findRow(processInstanceId, profileId);

  if (!row) {
    throw new NotFoundError('Voter enrolment', processInstanceId);
  }

  return row;
}

export async function resolveVoterAddress({
  processInstanceId,
  authUserId,
  address,
  geocode = defaultGeocode,
}: EnrolmentKey & {
  address: string;
  geocode?: Geocode;
}): Promise<AddressResolution> {
  const { profileId, instance, rule } = await loadEnrolmentContext({
    processInstanceId,
    authUserId,
  });
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
    .set({ taxonomyTermId: boundary?.taxonomyTermId ?? null })
    .where(rowFilter(processInstanceId, profileId));

  return {
    status: 'resolved',
    boundary: boundary ? { id: boundary.id, name: boundary.name } : null,
  };
}

export async function affirmVoterAttestation({
  processInstanceId,
  authUserId,
}: EnrolmentKey): Promise<DecisionVoterEnrolment> {
  const { profileId, instance, rule } = await loadEnrolmentContext({
    processInstanceId,
    authUserId,
  });
  const row = await findRow(processInstanceId, profileId);

  if (!row) {
    throw new ValidationError('Start enrolment before affirming');
  }

  if (isVoterEnrolled(row)) {
    return row;
  }

  if (rule.boundary && !row.taxonomyTermId) {
    const boundariesConfigured = instance.profileId
      ? await hasDecisionBoundaries({ profileId: instance.profileId })
      : false;
    if (boundariesConfigured) {
      throw new ValidationError('Give an address before affirming');
    }
  }

  const [enrolled] = await db
    .update(decisionVoterEnrolments)
    .set({ enrolledAt: new Date() })
    .where(rowFilter(processInstanceId, profileId))
    .returning();

  if (!enrolled) {
    throw new NotFoundError('Voter enrolment', processInstanceId);
  }

  return enrolled;
}
