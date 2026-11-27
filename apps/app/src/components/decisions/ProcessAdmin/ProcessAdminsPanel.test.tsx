// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
    members: { email: string | null; roles: { id: string }[] }[];
    invites: object[];
    searchResults: object[] | undefined;
    searchFailed: boolean;
    loadFails: boolean;
    debouncedQuery: string | undefined;
  } = {
    roles: [],
    members: [],
    invites: [],
    searchResults: undefined,
    searchFailed: false,
    loadFails: false,
    debouncedQuery: undefined,
  };
  const spies = {
    updateUserRoles: vi.fn(),
    removeUser: vi.fn(),
    deleteInvite: vi.fn(),
    invite: vi.fn(),
    updateInvite: vi.fn(),
    lookup: vi.fn(async ({ query }: { query: string }) => ({
      items: data.members.filter((m) => m.email?.includes(query)),
    })),
    invalidateUsers: vi.fn(async () => {}),
    invalidateInvites: vi.fn(async () => {}),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    logError: vi.fn(),
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
      client: { profile: { listUsers: { query: spies.lookup } } },
      profile: {
        listUsers: { invalidate: spies.invalidateUsers },
        listProfileInvites: { invalidate: spies.invalidateInvites },
      },
    }),
    useSuspenseQueries: (
      build: (t: {
        profile: {
          listUsers: (input: { roleId: string }) => unknown;
          listProfileInvites: () => unknown;
        };
      }) => unknown[],
    ) => {
      if (data.loadFails) {
        throw new Error('load failed');
      }
      return [
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
      ];
    },
    profile: {
      listRoles: { useSuspenseQuery: () => [{ items: data.roles }] },
      search: {
        useQuery: () => ({
          data: data.searchResults,
          isFetching: false,
          isError: data.searchFailed,
        }),
      },
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
  useDebounce: (value: string) => [data.debouncedQuery ?? value],
}));
vi.mock('@op/logging/client', () => ({ logger: { error: spies.logError } }));
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
  vi.restoreAllMocks();
  data.debouncedQuery = undefined;
  data.roles = [role(ADMIN, 'Admin'), role(REVIEWER, 'Reviewer')];
  data.invites = [];
  data.searchResults = undefined;
  data.searchFailed = false;
  data.loadFails = false;
});

const deferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const adminList = () => screen.getByRole('list');

const liveStatus = () => screen.getByRole('status').textContent;

const person = (id: string, name: string) => ({
  id: `p-${id}`,
  name,
  rank: 1,
  user: { email: `${id}@example.org` },
});

const searchBox = () =>
  screen.getByRole('combobox', {
    name: 'Search people on Common, or type an email address',
  });

const removeVia = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) => {
  await user.click(screen.getByRole('button', { name: `Manage ${name}` }));
  await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
};

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

  it('picks a person from the search and promotes them by name', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'paul', name: 'Paul', roles: [REVIEWER] }),
    ];
    data.searchResults = [
      {
        results: [
          {
            id: 'p-paul',
            name: 'Paul',
            rank: 1,
            user: { email: 'paul@example.org' },
          },
        ],
      },
    ];
    const user = renderPanel();

    await user.type(searchBox(), 'pa');
    await user.click(await screen.findByRole('option', { name: /Paul/ }));

    expect(spies.lookup).toHaveBeenCalledWith({
      profileId: 'profile-1',
      query: 'paul@example.org',
      limit: 100,
    });
    expect(spies.updateUserRoles).toHaveBeenCalledWith({
      profileUserId: 'pu-paul',
      roleIds: [REVIEWER, ADMIN],
    });
    await waitFor(() =>
      expect(toastMarkup(spies.toastSuccess)).toEqual([
        '<bdi>Paul</bdi> is now an admin.',
      ]),
    );
  });

  it('says a moved invitation already sent needs only to be accepted', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    data.invites = [
      {
        id: 'inv-other',
        email: 'other@example.org',
        accessRoleId: REVIEWER,
        notifiedAt: '2026-11-01T00:00:00.000Z',
      },
    ];
    const user = renderPanel();

    await pickEmail(user, 'other@example.org');

    await waitFor(() =>
      expect(toastMarkup(spies.toastSuccess)).toEqual([
        '<bdi>other@example.org</bdi> will be an admin once they accept the invitation.',
      ]),
    );
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
        '<bdi>other@example.org</bdi> will be an admin once they accept. Their invitation is sent when the process is published.',
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
    await waitFor(() =>
      expect(toastMarkup(spies.toastSuccess)).toEqual([
        'Invitation sent to <bdi>fresh@example.org</bdi>',
      ]),
    );
    expect(spies.toastError).not.toHaveBeenCalled();
  });

  it('holds the pending admin until the refreshed lists arrive', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    spies.invite.mockResolvedValueOnce({ details: { failed: [] } });
    const refetch = deferred();
    spies.invalidateUsers.mockReturnValueOnce(refetch.promise);
    const user = renderPanel();

    await pickEmail(user, 'fresh@example.org');
    await waitFor(() =>
      expect(spies.invalidateUsers).toHaveBeenCalledWith({
        profileId: 'profile-1',
      }),
    );
    expect(screen.getByText('Adding…')).toBeTruthy();

    refetch.resolve();

    await waitFor(() => expect(screen.queryByText('Adding…')).toBeNull());
  });

  it('says so when the invite comes back as failed', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    spies.invite.mockResolvedValueOnce({
      details: { failed: [{ email: 'fresh@example.org', reason: 'no' }] },
    });
    const user = renderPanel();

    await pickEmail(user, 'fresh@example.org');

    await waitFor(() =>
      expect(toastMarkup(spies.toastError)).toEqual([
        '<bdi>fresh@example.org</bdi> could not be invited.',
      ]),
    );
    expect(spies.toastSuccess).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Adding…')).toBeNull());
  });

  it.each([
    {
      step: 'the member lookup',
      email: 'paul@example.org',
      fail: () => spies.lookup.mockRejectedValueOnce(new Error('boom')),
    },
    {
      step: 'promoting a member',
      email: 'paul@example.org',
      fail: () =>
        spies.updateUserRoles.mockRejectedValueOnce(new Error('boom')),
    },
    {
      step: 'moving an invite',
      email: 'other@example.org',
      fail: () => spies.updateInvite.mockRejectedValueOnce(new Error('boom')),
    },
  ])(
    'takes the pending admin back out when $step fails',
    async ({ email, fail }) => {
      data.members = [
        member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
        member({ id: 'paul', name: 'Paul', roles: [REVIEWER] }),
      ];
      data.invites = [
        { id: 'inv-other', email: 'other@example.org', accessRoleId: REVIEWER },
      ];
      fail();
      const user = renderPanel();

      await pickEmail(user, email);

      await waitFor(() =>
        expect(toastMarkup(spies.toastError)).toEqual([
          `<bdi>${email}</bdi> could not be made an admin.`,
        ]),
      );
      await waitFor(() => expect(screen.queryByText('Adding…')).toBeNull());
      expect(spies.invite).not.toHaveBeenCalled();
    },
  );

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
    expect(within(adminList()).getByText('fresh@example.org')).toBeTruthy();
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
    expect(
      await within(adminList()).findByText('fresh@example.org'),
    ).toBeTruthy();

    fail(new Error('boom'));

    await waitFor(() =>
      expect(within(adminList()).queryByText('fresh@example.org')).toBeNull(),
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
    expect(within(adminList()).getByText('Sam')).toBeTruthy();

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

  it('announces a removal and returns focus to the search once the lists refresh', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'sam', name: 'Sam', roles: [ADMIN] }),
    ];
    spies.removeUser.mockResolvedValueOnce(undefined);
    const refetch = deferred();
    spies.invalidateUsers.mockReturnValueOnce(refetch.promise);
    const user = renderPanel();

    await removeVia(user, 'Sam');

    await waitFor(() => expect(spies.removeUser).toHaveBeenCalled());
    expect(screen.getByText('Removing…')).toBeTruthy();
    expect(spies.toastSuccess).not.toHaveBeenCalled();

    refetch.resolve();

    await waitFor(() =>
      expect(toastMarkup(spies.toastSuccess)).toEqual([
        '<bdi>Sam</bdi> is no longer an admin.',
      ]),
    );
    expect(document.activeElement).toBe(searchBox());
  });

  it('announces a withdrawn invitation', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    data.invites = [
      { id: 'inv-admin', email: 'new@example.org', accessRoleId: ADMIN },
    ];
    spies.deleteInvite.mockResolvedValueOnce(undefined);
    const user = renderPanel();

    await removeVia(user, 'new@example.org');

    await waitFor(() =>
      expect(toastMarkup(spies.toastSuccess)).toEqual([
        'The invitation to <bdi>new@example.org</bdi> was withdrawn.',
      ]),
    );
    expect(document.activeElement).toBe(searchBox());
  });

  it('keeps the admin and their roles when dropping the admin role fails', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'rita', name: 'Rita', roles: [ADMIN, REVIEWER] }),
    ];
    spies.updateUserRoles.mockRejectedValueOnce(new Error('boom'));
    const user = renderPanel();

    await removeVia(user, 'Rita');

    await waitFor(() =>
      expect(spies.toastError).toHaveBeenCalledWith(
        'This admin could not be removed.',
      ),
    );
    expect(spies.toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('Rita')).toBeTruthy();
  });

  it('recognises you by email when your profile is not linked', () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-other' }),
      member({ id: 'rita', name: 'Rita', roles: [ADMIN] }),
    ];
    renderPanel();

    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Manage Me' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Manage Rita' })).toBeTruthy();
  });

  it('offers only people who are not already admins or invited', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'rita', name: 'Rita', roles: [ADMIN] }),
    ];
    data.invites = [
      { id: 'inv-admin', email: 'ivy@example.org', accessRoleId: ADMIN },
    ];
    data.searchResults = [
      {
        results: [
          person('rita', 'Rita'),
          person('ivy', 'Ivy'),
          person('nina', 'Nina'),
        ],
      },
    ];
    const user = renderPanel();

    await user.type(searchBox(), 'ri');

    expect(await screen.findByRole('option', { name: /Nina/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Rita/ })).toBeNull();
    expect(screen.queryByRole('option', { name: /Ivy/ })).toBeNull();
  });

  it('says the search failed instead of showing no results', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    data.searchFailed = true;
    const user = renderPanel();

    await user.type(searchBox(), 'zz');

    expect(
      await screen.findByText('Could not search for people. Try again.'),
    ).toBeTruthy();
    expect(screen.queryByText('No results')).toBeNull();
  });

  it('shows an error when the admins cannot be loaded', () => {
    data.loadFails = true;
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    renderPanel();

    expect(screen.getByRole('alert').textContent).toBe(
      'The admins could not be loaded.',
    );
    expect(consoleError).toHaveBeenCalled();
  });

  it('reports a grant as done when only the refresh after it fails', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    spies.invite.mockResolvedValueOnce({ details: { failed: [] } });
    spies.invalidateUsers.mockRejectedValueOnce(new Error('offline'));
    const user = renderPanel();

    await pickEmail(user, 'fresh@example.org');

    await waitFor(() =>
      expect(toastMarkup(spies.toastSuccess)).toEqual([
        'Invitation sent to <bdi>fresh@example.org</bdi>',
      ]),
    );
    expect(spies.toastError).not.toHaveBeenCalled();
    expect(spies.logError).toHaveBeenCalledWith(
      'Process admin lists refresh failed',
      { error: expect.any(Error) },
    );
    await waitFor(() => expect(screen.queryByText('Adding…')).toBeNull());
  });

  it('reports a removal as done when only the refresh after it fails', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'sam', name: 'Sam', roles: [ADMIN] }),
    ];
    spies.removeUser.mockResolvedValueOnce(undefined);
    spies.invalidateUsers.mockRejectedValueOnce(new Error('offline'));
    const user = renderPanel();

    await removeVia(user, 'Sam');

    await waitFor(() =>
      expect(toastMarkup(spies.toastSuccess)).toEqual([
        '<bdi>Sam</bdi> is no longer an admin.',
      ]),
    );
    expect(spies.toastError).not.toHaveBeenCalled();
    expect(spies.logError).toHaveBeenCalledWith(
      'Process admin lists refresh failed',
      { error: expect.any(Error) },
    );
    await waitFor(() => expect(screen.queryByText('Removing…')).toBeNull());
  });

  it('logs a failed removal', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'sam', name: 'Sam', roles: [ADMIN] }),
    ];
    spies.removeUser.mockRejectedValueOnce(new Error('boom'));
    const user = renderPanel();

    await removeVia(user, 'Sam');

    await waitFor(() =>
      expect(spies.logError).toHaveBeenCalledWith(
        'Process admin removal failed',
        { error: expect.any(Error) },
      ),
    );
  });

  it('invites the address as typed now, not as the search last saw it', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    data.debouncedQuery = 'fresh@exmaple.org';
    spies.invite.mockResolvedValueOnce({ details: { failed: [] } });
    const user = renderPanel();

    await pickEmail(user, 'fresh@example.org');

    expect(spies.invite).toHaveBeenCalledWith({
      profileId: 'profile-1',
      invitations: [{ email: 'fresh@example.org', roleId: ADMIN }],
    });
  });

  it('gives focus back to the menu when a removal fails after focus was lost', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'sam', name: 'Sam', roles: [ADMIN] }),
    ];
    let fail = (_error: Error) => {};
    spies.removeUser.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    const user = renderPanel();

    await removeVia(user, 'Sam');
    await screen.findByText('Removing…');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    expect(document.activeElement).toBe(document.body);

    fail(new Error('boom'));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Manage Sam' }),
      ),
    );
  });

  it.each([
    { outcome: 'succeeds', settle: 'resolve' },
    { outcome: 'fails', settle: 'reject' },
  ])(
    'leaves focus where the user moved it when a removal $outcome',
    async ({ settle }) => {
      data.members = [
        member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
        member({ id: 'rita', name: 'Rita', roles: [ADMIN] }),
        member({ id: 'sam', name: 'Sam', roles: [ADMIN] }),
      ];
      let finish = () => {};
      spies.removeUser.mockReturnValueOnce(
        new Promise<void>((resolve, reject) => {
          finish =
            settle === 'resolve' ? resolve : () => reject(new Error('boom'));
        }),
      );
      const user = renderPanel();

      await removeVia(user, 'Sam');
      await screen.findByText('Removing…');
      const rita = screen.getByRole('button', { name: 'Manage Rita' });
      rita.focus();

      finish();

      await waitFor(() => expect(screen.queryByText('Removing…')).toBeNull());
      expect(document.activeElement).toBe(rita);
    },
  );

  it('announces an admin being added and removed', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'sam', name: 'Sam', roles: [ADMIN] }),
    ];
    spies.invite.mockReturnValueOnce(new Promise(() => {}));
    spies.removeUser.mockReturnValueOnce(new Promise(() => {}));
    const user = renderPanel();

    expect(liveStatus()).toBe('');

    await pickEmail(user, 'fresh@example.org');
    await waitFor(() =>
      expect(liveStatus()).toBe('Adding fresh@example.org… '),
    );

    await removeVia(user, 'Sam');
    await waitFor(() =>
      expect(liveStatus()).toBe('Adding fresh@example.org… Removing Sam… '),
    );
  });

  it('stops offering removal once the others in flight would leave one admin', async () => {
    data.members = [
      member({ id: 'rita', name: 'Rita', roles: [ADMIN] }),
      member({ id: 'sam', name: 'Sam', roles: [ADMIN] }),
    ];
    spies.removeUser.mockReturnValueOnce(new Promise(() => {}));
    const user = renderPanel();

    expect(screen.getByRole('button', { name: 'Manage Rita' })).toBeTruthy();

    await removeVia(user, 'Sam');

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Manage Rita' })).toBeNull(),
    );
    expect(screen.getByRole('button', { name: 'Manage Sam' })).toBeTruthy();
  });

  it('names an admin with no name or email', () => {
    const anonymous = {
      ...member({ id: 'anon', name: '', roles: [ADMIN] }),
      email: null,
      profile: null,
    };
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      anonymous,
    ];
    renderPanel();

    expect(screen.getByText('Unnamed admin')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Manage Unnamed admin' }),
    ).toBeTruthy();
  });

  it('offers an invite only for a valid email address', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    const user = renderPanel();
    const input = searchBox();

    await user.type(input, 'fresh@example');
    expect(await screen.findByText('No results')).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Invite/ })).toBeNull();

    await user.type(input, '.org');
    expect(
      await screen.findByRole('option', { name: 'Invite fresh@example.org' }),
    ).toBeTruthy();
  });

  it.each([
    { taken: 'an admin', email: 'rita@example.org' },
    { taken: 'an admin invite', email: 'ivy@example.org' },
    { taken: 'a pending pick', email: 'fresh@example.org' },
  ])('does not offer to invite $taken again', async ({ email }) => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
      member({ id: 'rita', name: 'Rita', roles: [ADMIN] }),
    ];
    data.invites = [
      { id: 'inv-ivy', email: 'ivy@example.org', accessRoleId: ADMIN },
    ];
    spies.invite.mockReturnValueOnce(new Promise(() => {}));
    const user = renderPanel();
    const input = searchBox();
    await pickEmail(user, 'fresh@example.org');
    await screen.findByText('Adding…');

    await user.type(input, 'new@example.org');
    expect(
      await screen.findByRole('option', { name: 'Invite new@example.org' }),
    ).toBeTruthy();

    await user.clear(input);
    await user.type(input, email);
    expect(await screen.findByText('No results')).toBeTruthy();
    expect(
      screen.queryByRole('option', { name: `Invite ${email}` }),
    ).toBeNull();
  });

  it('skips a search result that has no email', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    data.searchResults = [
      {
        results: [
          person('nina', 'Nina'),
          { id: 'p-ghost', name: 'Ghost', rank: 2, user: null },
        ],
      },
    ];
    const user = renderPanel();

    await user.type(searchBox(), 'ni');

    expect(await screen.findByRole('option', { name: /Nina/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Ghost/ })).toBeNull();
  });

  it('waits for two characters before showing results', async () => {
    data.members = [
      member({ id: 'me', name: 'Me', roles: [ADMIN], profileId: 'p-me' }),
    ];
    data.searchResults = [{ results: [person('nina', 'Nina')] }];
    const user = renderPanel();
    const input = searchBox();

    await user.type(input, 'n');
    expect(screen.queryByRole('option', { name: /Nina/ })).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();

    await user.type(input, 'i');
    expect(await screen.findByRole('option', { name: /Nina/ })).toBeTruthy();
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
