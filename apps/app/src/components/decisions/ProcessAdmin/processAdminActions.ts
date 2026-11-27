export interface AdminMember {
  id: string;
  email: string | null;
  isOwner: boolean | null;
  profile: { id: string } | null;
  roles: { id: string }[];
}

interface AdminInvite {
  id: string;
  email: string;
}

interface AdminRole {
  id: string;
  name: string;
  permissions?: { admin: boolean };
}

export type AdminPickerOption<Result extends { id: string } = { id: string }> =
  | { value: string; kind: 'person'; result: Result; email: string }
  | { value: string; kind: 'email'; email: string };

type AdminPickAction<Member, Invite> =
  | { kind: 'promote'; member: Member; roleIds: string[] }
  | { kind: 'moveInvite'; invite: Invite }
  | { kind: 'invite'; email: string };

type AdminRemoveAction =
  | { kind: 'demote'; profileUserId: string; roleIds: string[] }
  | { kind: 'remove'; profileUserId: string };

/** The default decision role is named Admin; a custom role with the admin bit is the fallback, never the first choice. */
export function findAdminRole<R extends AdminRole>(roles: R[]): R | undefined {
  return (
    roles.find((role) => role.name === 'Admin') ??
    roles.find((role) => role.permissions?.admin)
  );
}

export function getAdminPickAction<
  Member extends AdminMember,
  Invite extends AdminInvite,
>({
  option,
  members,
  invites,
  roleId,
}: {
  option: AdminPickerOption;
  members: Member[];
  invites: Invite[];
  roleId: string;
}): AdminPickAction<Member, Invite> {
  const email = option.email.toLowerCase();
  const member = members.find(
    (candidate) =>
      (option.kind === 'person' &&
        candidate.profile !== null &&
        candidate.profile.id === option.result.id) ||
      candidate.email?.toLowerCase() === email,
  );
  if (member) {
    const roleIds = member.roles.map((role) => role.id);
    return {
      kind: 'promote',
      member,
      roleIds: roleIds.includes(roleId) ? roleIds : [...roleIds, roleId],
    };
  }

  const invite = invites.find(
    (candidate) => candidate.email.toLowerCase() === email,
  );
  if (invite) {
    return { kind: 'moveInvite', invite };
  }

  return { kind: 'invite', email: option.email };
}

export function getAdminRemoveAction({
  admin,
  roleId,
}: {
  admin: AdminMember;
  roleId: string;
}): AdminRemoveAction {
  const otherRoleIds = admin.roles
    .filter((role) => role.id !== roleId)
    .map((role) => role.id);

  return otherRoleIds.length > 0
    ? { kind: 'demote', profileUserId: admin.id, roleIds: otherRoleIds }
    : { kind: 'remove', profileUserId: admin.id };
}

/** For an admin other than the viewer. The owner is protected by the server; the last-admin rule lives only here. */
export function canRemoveAdmin({
  admin,
  adminCount,
}: {
  admin: AdminMember;
  adminCount: number;
}): boolean {
  return !admin.isOwner && adminCount > 1;
}
