/** `with` for a profile's owning account; map `account?.authUser` through `toAccountContact`. */
export const withAccountContact = {
  account: {
    columns: {},
    orderBy: { createdAt: 'asc', id: 'asc' },
    with: { authUser: { columns: { email: true, phone: true } } },
  },
} as const;
