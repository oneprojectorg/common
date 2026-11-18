// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import { ProcessAdminsPanel } from './ProcessAdminsPanel';

const ADMIN = 'role-admin';
const REVIEWER = 'role-reviewer';

const { data, spies, mutation } = vi.hoisted(() => {
  const data: {
    roles: object[];
    members: { email: string; roles: { id: string }[] }[];
    invites: object[];
  } = {
    roles: [],
    members: [],
    invites: [],
  };
  const spies = {
    updateUserRoles: vi.fn(),
    removeUser: vi.fn(),
    deleteInvite: vi.fn(),
    invite: vi.fn(),
    updateInvite: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
  const mutation = (mutate: () => void) => ({
    useMutation: () => ({ mutate, mutateAsync: mutate, isPending: false }),
  });
  return { data, spies, mutation };
});

vi.mock('@op/api/client', () => ({
  trpc: {
    useUtils: () => ({
      // The pick lookup searches every member, past the admins the list shows.
      client: {
        profile: {
          listUsers: {
            query: async ({ query }: { query: string }) => ({
              items: data.members.filter((m) => m.email.includes(query)),
            }),
          },
        },
      },
      profile: {
        listUsers: { invalidate: async () => {} },
        listProfileInvites: { invalidate: async () => {} },
      },
    }),
    useSuspenseQueries: (
      build: (t: {
        profile: {
          listUsers: (input: { roleId: string }) => unknown;
          listProfileInvites: () => unknown;
        };
      }) => unknown[],
    ) => [
      build({
        profile: {
          listUsers: ({ roleId }) => ({
            items: data.members.filter((m) =>
              m.roles.some((r) => r.id === roleId),
            ),
          }),
          listProfileInvites: () => ({ items: data.invites }),
        },
      }),
      [],
    ],
    profile: {
      listRoles: { useSuspenseQuery: () => [{ items: data.roles }] },
      search: { useQuery: () => ({ data: undefined, isFetching: false }) },
      invite: mutation(spies.invite),
      updateUserRoles: mutation(spies.updateUserRoles),
      updateProfileInvite: mutation(spies.updateInvite),
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
vi.mock('@op/sense/Toast', () => ({
  toast: { success: spies.toastSuccess, error: spies.toastError },
}));

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

const pickEmail = async (
  user: ReturnType<typeof userEvent.setup>,
  email: string,
) => {
  await user.type(
    screen.getByRole('combobox', {
      name: 'Search people on Common, or type an email address',
    }),
    email,
  );
  await user.click(
    await screen.findByRole('option', { name: `Invite ${email}` }),
  );
};

const toastMarkup = (spy: Mock) =>
  spy.mock.calls.map(([message]) => renderToStaticMarkup(<>{message}</>));

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

  it('promotes a member found by the server lookup instead of inviting them', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'paul', name: 'Paul', roles: [REVIEWER] }),
    ];
    const user = renderPanel();

    await pickEmail(user, 'paul@example.org');

    expect(spies.updateUserRoles).toHaveBeenCalledWith({
      profileUserId: 'pu-paul',
      roleIds: [REVIEWER, ADMIN],
    });
    expect(spies.invite).not.toHaveBeenCalled();
  });

  it('moves a pending invitation to the admin role without claiming an email went out', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    data.invites = [
      { id: 'inv-other', email: 'other@example.org', accessRoleId: REVIEWER },
    ];
    const user = renderPanel();

    await pickEmail(user, 'other@example.org');

    expect(spies.updateInvite).toHaveBeenCalledWith({
      inviteId: 'inv-other',
      accessRoleId: ADMIN,
    });
    await waitFor(() =>
      expect(toastMarkup(spies.toastSuccess)).toEqual([
        '<bdi>other@example.org</bdi> will be an admin once they accept the invitation.',
      ]),
    );
    expect(spies.invite).not.toHaveBeenCalled();
  });

  it('invites an email that is neither a member nor invited', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    spies.invite.mockResolvedValueOnce({ details: { failed: [] } });
    const user = renderPanel();

    await pickEmail(user, 'fresh@example.org');

    expect(spies.invite).toHaveBeenCalledWith({
      profileId: 'profile-1',
      invitations: [{ email: 'fresh@example.org', roleId: ADMIN }],
    });
    expect(spies.updateUserRoles).not.toHaveBeenCalled();
  });

  it('shows the picked admin as pending, with the picker still usable, until the server confirms', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    let confirm = (_result: object) => {};
    spies.invite.mockReturnValueOnce(
      new Promise((resolve) => {
        confirm = resolve;
      }),
    );
    const user = renderPanel();

    await pickEmail(user, 'fresh@example.org');

    expect(await screen.findByText('Adding…')).toBeTruthy();
    expect(screen.getByText('fresh@example.org')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Manage fresh@example.org' }),
    ).toBeNull();
    expect(
      screen
        .getByRole('combobox', {
          name: 'Search people on Common, or type an email address',
        })
        .hasAttribute('disabled'),
    ).toBe(false);

    data.invites = [
      { id: 'inv-fresh', email: 'fresh@example.org', accessRoleId: ADMIN },
    ];
    confirm({ details: { failed: [] } });

    await waitFor(() => expect(screen.queryByText('Adding…')).toBeNull());
    expect(
      screen.getByRole('button', { name: 'Manage fresh@example.org' }),
    ).toBeTruthy();
  });

  it('puts the pending admin where the confirmed row will land', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'zed', name: 'Zed', roles: [ADMIN] }),
      member({ id: 'paul', name: 'Paul', roles: [REVIEWER] }),
    ];
    data.invites = [
      { id: 'inv-a', email: 'anna@example.org', accessRoleId: ADMIN },
      { id: 'inv-z', email: 'zoe@example.org', accessRoleId: ADMIN },
    ];
    spies.invite.mockReturnValueOnce(new Promise(() => {}));
    spies.updateUserRoles.mockReturnValueOnce(new Promise(() => {}));
    const user = renderPanel();

    await pickEmail(user, 'mia@example.org');
    await pickEmail(user, 'paul@example.org');
    await waitFor(() => expect(screen.getAllByText('Adding…')).toHaveLength(2));

    const rows = screen
      .getAllByRole('listitem')
      .map((row) => row.textContent ?? '');
    const position = (text: string) =>
      rows.findIndex((row) => row.includes(text));
    expect(
      ['Me', 'Paul', 'Zed', 'anna@', 'mia@', 'zoe@'].map(position),
    ).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('takes the pending admin back out when the grant fails', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    let fail = (_error: Error) => {};
    spies.invite.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    const user = renderPanel();

    await pickEmail(user, 'fresh@example.org');
    expect(await screen.findByText('fresh@example.org')).toBeTruthy();

    fail(new Error('boom'));

    await waitFor(() =>
      expect(screen.queryByText('fresh@example.org')).toBeNull(),
    );
    expect(toastMarkup(spies.toastError)).toEqual([
      '<bdi>fresh@example.org</bdi> could not be invited.',
    ]);
  });

  it('shows an admin being removed as pending until the server confirms', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'sam', name: 'Sam', roles: [ADMIN] }),
    ];
    let confirm = () => {};
    spies.removeUser.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        confirm = resolve;
      }),
    );
    const user = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Manage Sam' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));

    expect(await screen.findByText('Removing…')).toBeTruthy();
    expect(screen.getByText('Sam')).toBeTruthy();

    expect(
      screen
        .getByRole('button', { name: 'Manage Sam' })
        .hasAttribute('disabled'),
    ).toBe(true);

    confirm();

    await waitFor(() => expect(screen.queryByText('Removing…')).toBeNull());
  });

  it('keeps the admin in the list when the removal fails', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'sam', name: 'Sam', roles: [ADMIN] }),
    ];
    spies.removeUser.mockRejectedValueOnce(new Error('boom'));
    const user = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Manage Sam' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));

    await waitFor(() =>
      expect(spies.toastError).toHaveBeenCalledWith(
        'This admin could not be removed.',
      ),
    );
    expect(screen.queryByText('Removing…')).toBeNull();
    expect(screen.getByText('Sam')).toBeTruthy();
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
