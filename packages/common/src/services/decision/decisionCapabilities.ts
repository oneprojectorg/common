import { db } from '@op/db/client';
import { accessRolePermissionsOnAccessZones } from '@op/db/schema';
import { eq } from 'drizzle-orm';

import { NotFoundError } from '../../utils';
import { assertProfileAdmin } from '../assert';
import {
  CRUD_BITS_MASK,
  type DecisionCapabilities,
  fromDecisionBitField,
  toDecisionBitField,
} from './permissions';

/**
 * Get the decision-specific capabilities for a role on the decisions zone.
 */
export async function getDecisionCapabilities({
  roleId,
}: {
  roleId: string;
}): Promise<DecisionCapabilities> {
  const zone = await db._query.accessZones.findFirst({
    where: (table, { eq }) => eq(table.name, 'decisions'),
  });

  if (!zone) {
    throw new NotFoundError('Zone', 'decisions');
  }

  const existing = await db._query.accessRolePermissionsOnAccessZones.findFirst(
    {
      where: (table, { eq, and }) =>
        and(eq(table.accessRoleId, roleId), eq(table.accessZoneId, zone.id)),
    },
  );

  return fromDecisionBitField(existing?.permission ?? 0);
}

/**
 * Update the decision capabilities for a role on the decisions zone.
 * Preserves CRUD bits (0–3); overwrites admin (bit 4) and decision bits (6–9).
 */
export async function updateDecisionCapabilities({
  roleId,
  decisionPermissions,
  user,
}: {
  roleId: string;
  decisionPermissions: DecisionCapabilities;
  user: { id: string };
}) {
  const [zone, role] = await Promise.all([
    db._query.accessZones.findFirst({
      where: (table, { eq }) => eq(table.name, 'decisions'),
    }),
    db._query.accessRoles.findFirst({
      where: (table, { eq }) => eq(table.id, roleId),
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

  const existing = await db._query.accessRolePermissionsOnAccessZones.findFirst(
    {
      where: (table, { eq, and }) =>
        and(eq(table.accessRoleId, roleId), eq(table.accessZoneId, zone.id)),
    },
  );

  const existingCrud = (existing?.permission ?? 0) & CRUD_BITS_MASK;
  const newDecisionBits = toDecisionBitField(decisionPermissions);
  const bitfield = existingCrud | newDecisionBits;

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
