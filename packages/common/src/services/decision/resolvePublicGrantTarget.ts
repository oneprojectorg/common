import { db } from '@op/db/client';

import { NotFoundError, ValidationError } from '../../utils';

/**
 * The rows a public grant is written against: the decision's own profile, plus
 * the seeded `decisions` zone and global `Public` role, both resolved by name
 * rather than by seeded id.
 */
export const resolvePublicGrantTarget = async ({
  instanceId,
}: {
  instanceId: string;
}): Promise<{ profileId: string; zoneId: string; publicRoleId: string }> => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { profileId: true },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', instanceId);
  }

  if (!instance.profileId) {
    throw new ValidationError(
      'This decision has no profile of its own, so its public access cannot be changed',
    );
  }

  const [zone, publicRole] = await Promise.all([
    db.query.accessZones.findFirst({ where: { name: 'decisions' } }),
    db.query.accessRoles.findFirst({
      where: { name: 'Public', profileId: { isNull: true } },
      columns: { id: true },
    }),
  ]);

  if (!zone) {
    throw new NotFoundError('Zone', 'decisions');
  }

  if (!publicRole) {
    throw new NotFoundError('Role', 'Public');
  }

  return {
    profileId: instance.profileId,
    zoneId: zone.id,
    publicRoleId: publicRole.id,
  };
};
