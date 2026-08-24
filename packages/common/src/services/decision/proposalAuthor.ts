import { proposalProfileColumns } from './proposalProfileColumns';

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
