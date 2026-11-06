/**
 * Loads the account that owns a profile with its `auth.users` email and phone:
 * spread into a `profiles` query's `with`, then map `row.account?.authUser`
 * through `toAccountContact`. `users.profileId` is not unique, so the oldest
 * owning row wins.
 */
export const withAccountContact = {
  account: {
    columns: {},
    orderBy: { createdAt: 'asc', id: 'asc' },
    with: { authUser: { columns: { email: true, phone: true } } },
  },
} as const;
