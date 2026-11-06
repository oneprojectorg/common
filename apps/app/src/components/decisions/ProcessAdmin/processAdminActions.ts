/** The slice of a profile member the admin rules read. */
export interface AdminMember {
  id: string;
  email: string | null;
  isOwner: boolean | null;
  profile: { id: string } | null;
  roles: { id: string }[];
}

export interface AdminInvite {
  id: string;
  email: string;
}

export interface AdminRole {
  id: string;
  name: string;
  permissions?: { admin: boolean };
}

/** A pick from the admin search: a person row (with the profile it names) or a typed email. */
export type AdminPickerOption<Result extends { id: string } = { id: string }> =
  | { value: string; kind: 'person'; result: Result; email: string }
  | { value: string; kind: 'email'; email: string };

/** What picking someone in the admin picker should call. */
export type AdminPickAction =
  | { kind: 'promote'; profileUserId: string; roleIds: string[] }
  | { kind: 'moveInvite'; inviteId: string }
  | { kind: 'invite'; email: string };

/** What removing an admin should call: drop the role when they hold others, else the membership. */
export type AdminRemoveAction =
  | { kind: 'demote'; profileUserId: string; roleIds: string[] }
  | { kind: 'remove'; profileUserId: string };

/** The default decision role is named Admin; a custom role with the admin bit is the fallback, never the first choice. */
export function findAdminRole<R extends AdminRole>(roles: R[]): R | undefined {
  return (
    roles.find((role) => role.name === 'Admin') ??
    roles.find((role) => role.permissions?.admin)
  );
}

export function getAdminPickAction({
  option,
  members,
  invites,
  roleId,
}: {
  option: AdminPickerOption;
  members: AdminMember[];
  invites: AdminInvite[];
  roleId: string;
}): AdminPickAction {
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
      profileUserId: member.id,
      roleIds: roleIds.includes(roleId) ? roleIds : [...roleIds, roleId],
    };
  }

  const pendingInvite = invites.find(
    (invite) => invite.email.toLowerCase() === email,
  );
  if (pendingInvite) {
    return { kind: 'moveInvite', inviteId: pendingInvite.id };
  }

  return { kind: 'invite', email: option.email };
}

export function getAdminRemoveAction(
  admin: AdminMember,
  roleId: string,
): AdminRemoveAction {
  const otherRoleIds = admin.roles
    .filter((role) => role.id !== roleId)
    .map((role) => role.id);

  return otherRoleIds.length > 0
    ? { kind: 'demote', profileUserId: admin.id, roleIds: otherRoleIds }
    : { kind: 'remove', profileUserId: admin.id };
}

/** The owner is protected by the server; the self and last-admin rules live only here. */
export function canRemoveAdmin({
  admin,
  isSelf,
  adminCount,
}: {
  admin: AdminMember;
  isSelf: boolean;
  adminCount: number;
}): boolean {
  return !isSelf && !admin.isOwner && adminCount > 1;
}
