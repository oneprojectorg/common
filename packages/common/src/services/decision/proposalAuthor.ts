/**
 * Column picks for the `submittedBy`/`profile` relations on list rows. Wide
 * because the legacy results encoder (`baseProfileEncoder`) needs the whole
 * profile; keeps the generated `search` tsvector out of the lateral joins.
 */
export const proposalProfileColumns = {
  id: true,
  type: true,
  slug: true,
  name: true,
  city: true,
  state: true,
  bio: true,
  mission: true,
  email: true,
  website: true,
} satisfies Record<string, true>;

/**
 * The `submittedBy` branch a proposal card read selects. Shared so a read can't
 * omit the `profileUsers` join: without it `isAnonymousAuthor` sees no rows and
 * every author folds to "not anonymous", which links their profile.
 */
export const proposalAuthorRelation = {
  columns: proposalProfileColumns,
  with: {
    avatarImage: true,
    profileUsers: {
      columns: {},
      with: { authUser: { columns: { isAnonymous: true } } },
    },
  },
} as const;

/** True when any account behind the author's profile is anonymous. */
export function isAnonymousAuthor(
  profileUsers?: Array<{ authUser: { isAnonymous: boolean } | null }> | null,
): boolean {
  return Boolean(profileUsers?.some((pu) => pu.authUser?.isAnonymous));
}
