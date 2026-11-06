// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import { ProcessAdminsPanel } from './ProcessAdminsPanel';

const ADMIN = 'role-admin';
const REVIEWER = 'role-reviewer';

const { data, spies, mutation } = vi.hoisted(() => {
  const data: { roles: object[]; members: object[]; invites: object[] } = {
    roles: [],
    members: [],
    invites: [],
  };
  const spies = {
    updateUserRoles: vi.fn(),
    removeUser: vi.fn(),
    deleteInvite: vi.fn(),
    invite: vi.fn(),
  };
  const mutation = (mutate: () => void) => ({
    useMutation: () => ({ mutate, isPending: false }),
  });
  return { data, spies, mutation };
});

vi.mock('@op/api/client', () => ({
  trpc: {
    useUtils: () => ({
      profile: {
        listUsers: { invalidate: async () => {} },
        listProfileInvites: { invalidate: async () => {} },
      },
    }),
    profile: {
      listRoles: { useSuspenseQuery: () => [{ items: data.roles }] },
      listUsers: { useSuspenseQuery: () => [{ items: data.members }] },
      listProfileInvites: {
        useSuspenseQuery: () => [{ items: data.invites }],
      },
      search: { useQuery: () => ({ data: undefined, isFetching: false }) },
      invite: mutation(spies.invite),
      updateUserRoles: mutation(spies.updateUserRoles),
      updateProfileInvite: mutation(() => {}),
      removeUser: mutation(spies.removeUser),
      deleteProfileInvite: mutation(spies.deleteInvite),
    },
  },
}));

vi.mock('@/utils/UserProvider', () => ({
  useMaybeUser: () => ({ profileId: 'p-me', email: 'me@example.org' }),
}));
vi.mock('@op/hooks', () => ({
  useDebounce: (value: string) => [value],
}));
vi.mock('@op/logging/client', () => ({ logger: { error: () => {} } }));

const role = (id: string, name: string) => ({
  id,
  name,
  permissions: { admin: id === ADMIN },
});

const member = ({
  id,
  name,
  roles,
  isOwner = false,
  profileId = `p-${id}`,
}: {
  id: string;
  name: string;
  roles: string[];
  isOwner?: boolean;
  profileId?: string;
}) => ({
  id: `pu-${id}`,
  name,
  email: `${id}@example.org`,
  isOwner,
  profile: { id: profileId, name },
  roles: roles.map((roleId) => ({ id: roleId, name: roleId })),
});

const renderPanel = () => {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ProcessAdminsPanel profileId="profile-1" />
    </NextIntlClientProvider>,
  );
  return userEvent.setup();
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  data.roles = [role(ADMIN, 'Admin'), role(REVIEWER, 'Reviewer')];
  data.invites = [];
});

describe('ProcessAdminsPanel', () => {
  it('lists the admins, marks you, and offers removal only where allowed', () => {
    data.roles = [role(ADMIN, 'Admin'), role(REVIEWER, 'Reviewer')];
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'owner', name: 'Owner', roles: [ADMIN], isOwner: true }),
      member({ id: 'rita', name: 'Rita', roles: [ADMIN, REVIEWER] }),
      member({ id: 'paul', name: 'Paul', roles: [REVIEWER] }),
    ];
    data.invites = [
      { id: 'inv-admin', email: 'new@example.org', accessRoleId: ADMIN },
      { id: 'inv-other', email: 'other@example.org', accessRoleId: REVIEWER },
    ];
    renderPanel();

    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Manage Me' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Manage Owner' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Manage Rita' })).toBeTruthy();
    expect(screen.queryByText('Paul')).toBeNull();
    expect(screen.getByText('new@example.org')).toBeTruthy();
    expect(screen.getByText('Invited')).toBeTruthy();
    expect(screen.queryByText('other@example.org')).toBeNull();
  });

  it('never offers to remove the only admin', () => {
    data.members = [member({ id: 'rita', name: 'Rita', roles: [ADMIN] })];
    renderPanel();

    expect(screen.getByText('Rita')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Manage Rita' })).toBeNull();
  });

  it('drops only the admin role from an admin who holds another role', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'rita', name: 'Rita', roles: [ADMIN, REVIEWER] }),
    ];
    const user = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Manage Rita' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));

    expect(spies.updateUserRoles).toHaveBeenCalledWith({
      profileUserId: 'pu-rita',
      roleIds: [REVIEWER],
    });
    expect(spies.removeUser).not.toHaveBeenCalled();
  });

  it('removes the membership when admin is the only role', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'sam', name: 'Sam', roles: [ADMIN] }),
    ];
    const user = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Manage Sam' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));

    expect(spies.removeUser).toHaveBeenCalledWith({ profileUserId: 'pu-sam' });
    expect(spies.updateUserRoles).not.toHaveBeenCalled();
  });

  it('withdraws a pending admin invitation', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    data.invites = [
      { id: 'inv-admin', email: 'new@example.org', accessRoleId: ADMIN },
    ];
    const user = renderPanel();

    await user.click(
      screen.getByRole('button', { name: 'Manage new@example.org' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));

    expect(spies.deleteInvite).toHaveBeenCalledWith({ inviteId: 'inv-admin' });
  });

  it('says so when the process has no admin role', () => {
    data.roles = [role(REVIEWER, 'Reviewer')];
    data.members = [];
    renderPanel();

    expect(
      screen.getByText('This process has no admin role to add people to.'),
    ).toBeTruthy();
  });
});
