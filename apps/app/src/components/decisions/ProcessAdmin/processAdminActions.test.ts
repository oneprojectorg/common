import { describe, expect, it } from 'vitest';

import {
  type AdminMember,
  type AdminPickerOption,
  canRemoveAdmin,
  findAdminRole,
  getAdminPickAction,
  getAdminRemoveAction,
} from './processAdminActions';

const ADMIN = 'role-admin';
const REVIEWER = 'role-reviewer';

const member = ({
  id,
  email = null,
  profileId = null,
  roles = [ADMIN],
  isOwner = false,
}: {
  id: string;
  email?: string | null;
  profileId?: string | null;
  roles?: string[];
  isOwner?: boolean;
}): AdminMember => ({
  id,
  email,
  isOwner,
  profile: profileId ? { id: profileId } : null,
  roles: roles.map((roleId) => ({ id: roleId })),
});

const person = (profileId: string, email: string): AdminPickerOption => ({
  value: profileId,
  kind: 'person',
  email,
  result: { id: profileId },
});

describe('findAdminRole', () => {
  it('prefers the role named Admin over a custom role with the admin bit', () => {
    const roles = [
      { id: 'custom', name: 'Accountability', permissions: { admin: true } },
      { id: ADMIN, name: 'Admin', permissions: { admin: true } },
    ];

    expect(findAdminRole(roles)?.id).toBe(ADMIN);
  });

  it('falls back to a role with the admin bit when none is named Admin', () => {
    const roles = [
      { id: 'participant', name: 'Participant', permissions: { admin: false } },
      { id: 'custom', name: 'Stewards', permissions: { admin: true } },
    ];

    expect(findAdminRole(roles)?.id).toBe('custom');
  });
});

describe('getAdminPickAction', () => {
  const members = [
    member({ id: 'pu-reviewer', profileId: 'p-reviewer', roles: [REVIEWER] }),
    member({ id: 'pu-mail', email: 'Mail@Example.org', roles: [REVIEWER] }),
  ];
  const invites = [{ id: 'invite-1', email: 'pending@example.org' }];

  it('promotes an existing member found by profile, keeping their roles', () => {
    expect(
      getAdminPickAction({
        option: person('p-reviewer', 'r@example.org'),
        members,
        invites,
        roleId: ADMIN,
      }),
    ).toEqual({
      kind: 'promote',
      profileUserId: 'pu-reviewer',
      roleIds: [REVIEWER, ADMIN],
    });
  });

  it('promotes an existing member found by email, case-insensitively', () => {
    expect(
      getAdminPickAction({
        option: {
          value: 'add-email',
          kind: 'email',
          email: 'mail@example.org',
        },
        members,
        invites,
        roleId: ADMIN,
      }),
    ).toMatchObject({ kind: 'promote', profileUserId: 'pu-mail' });
  });

  it('moves a pending invite onto the admin role instead of inviting twice', () => {
    expect(
      getAdminPickAction({
        option: {
          value: 'add-email',
          kind: 'email',
          email: 'Pending@example.org',
        },
        members,
        invites,
        roleId: ADMIN,
      }),
    ).toEqual({ kind: 'moveInvite', inviteId: 'invite-1' });
  });

  it('invites someone new', () => {
    expect(
      getAdminPickAction({
        option: { value: 'add-email', kind: 'email', email: 'new@example.org' },
        members,
        invites,
        roleId: ADMIN,
      }),
    ).toEqual({ kind: 'invite', email: 'new@example.org' });
  });
});

describe('getAdminRemoveAction', () => {
  it('drops only the admin role from someone who holds another', () => {
    expect(
      getAdminRemoveAction(
        member({ id: 'pu', roles: [ADMIN, REVIEWER] }),
        ADMIN,
      ),
    ).toEqual({ kind: 'demote', profileUserId: 'pu', roleIds: [REVIEWER] });
  });

  it('removes the membership when admin is the only role', () => {
    expect(getAdminRemoveAction(member({ id: 'pu' }), ADMIN)).toEqual({
      kind: 'remove',
      profileUserId: 'pu',
    });
  });
});

describe('canRemoveAdmin', () => {
  const admin = member({ id: 'pu' });

  it('never offers to remove yourself, the owner, or the last admin', () => {
    expect(canRemoveAdmin({ admin, isSelf: true, adminCount: 3 })).toBe(false);
    expect(
      canRemoveAdmin({
        admin: member({ id: 'owner', isOwner: true }),
        isSelf: false,
        adminCount: 3,
      }),
    ).toBe(false);
    expect(canRemoveAdmin({ admin, isSelf: false, adminCount: 1 })).toBe(false);
  });

  it('offers to remove another admin when more remain', () => {
    expect(canRemoveAdmin({ admin, isSelf: false, adminCount: 2 })).toBe(true);
  });
});
