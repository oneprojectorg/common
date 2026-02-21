import { db } from '@op/db/client';
import { accessRolePermissionsOnAccessZones } from '@op/db/schema';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { NotFoundError } from '../../utils';
import { assertProfileAdmin } from '../assert';
import {
  type DecisionRolePermissions,
  fromDecisionBitField,
  toDecisionBitField,
} from './permissions';

/**
 * Get the decision role permissions for a role on the decisions zone.
 */
export async function getDecisionRoles({
  roleId,
}: {
  roleId: string;
}): Promise<DecisionRolePermissions> {
  const zone = await db.query.accessZones.findFirst({
    where: { name: 'decisions' },
  });

  if (!zone) {
    throw new NotFoundError('Zone', 'decisions');
  }

  const existing = await db.query.accessRolePermissionsOnAccessZones.findFirst({
    where: { accessRoleId: roleId, accessZoneId: zone.id },
  });

  return fromDecisionBitField(existing?.permission ?? 0);
}

/**
 * Update the decision role permissions for a role on the decisions zone.
 * Preserves CRUD bits (0–3); overwrites admin (bit 4) and decision bits (6–9).
 */
export async function updateDecisionRoles({
  roleId,
  decisionPermissions,
  user,
}: {
  roleId: string;
  decisionPermissions: DecisionRolePermissions;
  user: { id: string };
}) {
  const [zone, role] = await Promise.all([
    db.query.accessZones.findFirst({
      where: { name: 'decisions' },
    }),
    db.query.accessRoles.findFirst({
      where: { id: roleId },
    }),
  ]);

  if (!zone) {
    throw new NotFoundError('Zone', 'decisions');
  }

  if (!role) {
    throw new NotFoundError('Role', roleId);
  }

  if (!role.profileId) {
    throw new NotFoundError('Role', roleId);
  }

  await assertProfileAdmin(user, role.profileId);

  const existing = await db.query.accessRolePermissionsOnAccessZones.findFirst({
    where: { accessRoleId: roleId, accessZoneId: zone.id },
  });

  const bitfield = toDecisionBitField(decisionPermissions) | permission.READ;

  if (existing) {
    await db
      .update(accessRolePermissionsOnAccessZones)
      .set({ permission: bitfield })
      .where(eq(accessRolePermissionsOnAccessZones.id, existing.id));
  } else {
    await db.insert(accessRolePermissionsOnAccessZones).values({
      accessRoleId: roleId,
      accessZoneId: zone.id,
      permission: bitfield,
    });
  }

  return { roleId, decisionPermissions };
}
