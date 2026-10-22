import { describe, expect, it } from 'vitest';

import { getNormalizedRoles, pickEffectivePermissionRows } from './utils';

type Row = {
  accessZoneId: string;
  permission: number;
  profileId?: string | null;
};

const byZone = (row: Row) => row.accessZoneId;

const globalRow = (accessZoneId: string, permission: number): Row => ({
  accessZoneId,
  permission,
  profileId: null,
});

const scopedRow = (
  accessZoneId: string,
  permission: number,
  profileId: string,
): Row => ({ accessZoneId, permission, profileId });

describe('pickEffectivePermissionRows', () => {
  it('keeps global rows as-is when no scoped rows exist', () => {
    const rows = [globalRow('zoneA', 7), globalRow('zoneB', 4)];

    expect(pickEffectivePermissionRows(rows, byZone, 'profile-1')).toEqual(
      rows,
    );
  });

  it('treats an absent profileId field the same as null (global)', () => {
    const rows: Row[] = [{ accessZoneId: 'zoneA', permission: 7 }];

    expect(pickEffectivePermissionRows(rows, byZone, 'profile-1')).toEqual(
      rows,
    );
  });

  it('lets a scoped row override the global row when the global comes first', () => {
    const rows = [globalRow('zoneA', 7), scopedRow('zoneA', 1, 'profile-1')];

    expect(pickEffectivePermissionRows(rows, byZone, 'profile-1')).toEqual([
      scopedRow('zoneA', 1, 'profile-1'),
    ]);
  });

  it('lets a scoped row override the global row when the scoped comes first', () => {
    const rows = [scopedRow('zoneA', 1, 'profile-1'), globalRow('zoneA', 7)];

    expect(pickEffectivePermissionRows(rows, byZone, 'profile-1')).toEqual([
      scopedRow('zoneA', 1, 'profile-1'),
    ]);
  });

  it('only overrides the matching key, leaving other zones on their global rows', () => {
    const rows = [
      globalRow('zoneA', 7),
      globalRow('zoneB', 4),
      scopedRow('zoneA', 1, 'profile-1'),
    ];

    expect(pickEffectivePermissionRows(rows, byZone, 'profile-1')).toEqual([
      scopedRow('zoneA', 1, 'profile-1'),
      globalRow('zoneB', 4),
    ]);
  });

  it('drops rows scoped to a different profile', () => {
    const rows = [globalRow('zoneA', 7), scopedRow('zoneA', 1, 'profile-2')];

    expect(pickEffectivePermissionRows(rows, byZone, 'profile-1')).toEqual([
      globalRow('zoneA', 7),
    ]);
  });

  it('keeps a scoped row that has no global counterpart', () => {
    const rows = [scopedRow('zoneA', 1, 'profile-1')];

    expect(pickEffectivePermissionRows(rows, byZone, 'profile-1')).toEqual([
      scopedRow('zoneA', 1, 'profile-1'),
    ]);
  });

  it('drops all scoped rows when no profileId is given (fail closed)', () => {
    const rows = [
      globalRow('zoneA', 7),
      scopedRow('zoneA', 1, 'profile-1'),
      scopedRow('zoneB', 4, 'profile-2'),
    ];

    expect(pickEffectivePermissionRows(rows, byZone)).toEqual([
      globalRow('zoneA', 7),
    ]);
    expect(pickEffectivePermissionRows(rows, byZone, null)).toEqual([
      globalRow('zoneA', 7),
    ]);
  });

  it('keeps a single row per key when duplicate global rows exist', () => {
    const rows = [globalRow('zoneA', 7), globalRow('zoneA', 4)];

    const result = pickEffectivePermissionRows(rows, byZone, 'profile-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.accessZoneId).toBe('zoneA');
  });

  it('keeps a single row per key when duplicate scoped rows exist', () => {
    const rows = [
      scopedRow('zoneA', 1, 'profile-1'),
      scopedRow('zoneA', 2, 'profile-1'),
    ];

    const result = pickEffectivePermissionRows(rows, byZone, 'profile-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.profileId).toBe('profile-1');
  });

  it('returns an empty array for no rows', () => {
    expect(pickEffectivePermissionRows([], byZone, 'profile-1')).toEqual([]);
  });
});

describe('getNormalizedRoles', () => {
  const zone = (id: string, name: string) => ({ id, name });

  const roleJunctions = [
    {
      accessRole: {
        id: 'role-1',
        name: 'Member',
        zonePermissions: [
          {
            accessRoleId: 'role-1',
            accessZoneId: 'zoneA',
            permission: 7,
            profileId: null,
            accessZone: zone('zoneA', 'decisions'),
          },
          {
            accessRoleId: 'role-1',
            accessZoneId: 'zoneA',
            permission: 1,
            profileId: 'profile-1',
            accessZone: zone('zoneA', 'decisions'),
          },
          {
            accessRoleId: 'role-1',
            accessZoneId: 'zoneB',
            permission: 4,
            profileId: 'profile-2',
            accessZone: zone('zoneB', 'admin'),
          },
        ],
      },
    },
  ];

  it('applies per-profile overrides and drops foreign-scoped rows', () => {
    expect(
      getNormalizedRoles(roleJunctions, { profileId: 'profile-1' }),
    ).toEqual([{ id: 'role-1', name: 'Member', access: { decisions: 1 } }]);
  });

  it('uses only global rows when no profileId is given', () => {
    expect(getNormalizedRoles(roleJunctions)).toEqual([
      { id: 'role-1', name: 'Member', access: { decisions: 7 } },
    ]);
  });

  it('normalizes a role without zonePermissions to empty access', () => {
    expect(
      getNormalizedRoles([{ accessRole: { id: 'role-2', name: 'Empty' } }]),
    ).toEqual([{ id: 'role-2', name: 'Empty', access: {} }]);
  });
});
