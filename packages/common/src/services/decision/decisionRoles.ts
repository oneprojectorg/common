import { type TransactionType, db } from '@op/db/client';
import { accessRolePermissionsOnAccessZones, accessRoles } from '@op/db/schema';
import { permission, toBitField } from 'access-zones';
import { eq } from 'drizzle-orm';

import { CommonError, NotFoundError } from '../../utils';
import { assertProfileAdmin } from '../assert';
import {
  type DecisionRolePermissions,
  fromDecisionBitField,
  toDecisionBitField,
} from './permissions';

type ZonePermission =
  | { type: 'decision'; value: DecisionRolePermissions }
  | { type: 'acrud'; value: { admin: boolean; create: boolean; read: boolean; update: boolean; delete: boolean } };

function toBitfield(zonePermission: ZonePermission): number {
  if (zonePermission.type === 'decision') {
    return toDecisionBitField(zonePermission.value) | permission.READ;
  }
  return toBitField(zonePermission.value);
}

/**
 * Create a decision role with permissions on one or more zones.
 * Each zone entry specifies its type: 'decision' for decision-specific bits,
 * or 'acrud' for standard access-zones bits.
 */
export async function createDecisionRole({
  name,
  profileId,
  permissions,
  description,
  tx,
}: {
  name: string;
  profileId: string;
  permissions: Record<string, ZonePermission>;
  description?: string;
  tx?: TransactionType;
}) {
  const client = tx ?? db;

  const zoneNames = Object.keys(permissions);
  const zones = await Promise.all(
    zoneNames.map((zoneName) =>
      client.query.accessZones.findFirst({ where: { name: zoneName } }),
    ),
  );

  const zoneMap = new Map(
    zoneNames.map((zoneName, i) => {
      const zone = zones[i];
      if (!zone) {
        throw new NotFoundError('Zone', zoneName);
      }
      return [zoneName, zone];
    }),
  );

  const [role] = await client
    .insert(accessRoles)
    .values({ name, description, profileId })
    .returning();

  if (!role) {
    throw new CommonError('Failed to create decision role');
  }

  await client.insert(accessRolePermissionsOnAccessZones).values(
    zoneNames.map((zoneName) => ({
      accessRoleId: role.id,
      accessZoneId: zoneMap.get(zoneName)!.id,
      permission: toBitfield(permissions[zoneName]!),
    })),
  );

  return { id: role.id, name: role.name, permissions };
}

/**
 * Get the decision role permissions for a role on the decisions zone.
 */
export async function getDecisionRole({
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
