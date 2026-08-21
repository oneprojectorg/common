import { proposalProfileColumns } from './proposalProfileColumns';

/**
 * The `submittedBy` branch a proposal card read selects: the author's profile,
 * their avatar, and the `profileUsers → authUser` hop that says whether the
 * account is anonymous.
 *
 * Shared so a read can't quietly omit the anonymity join — without it
 * `isAnonymousAuthor` sees no rows and every author folds to "not anonymous",
 * which reads as a normal byline and links the profile.
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

/**
 * Whether a proposal's author submitted from an anonymous account.
 *
 * One implementation on purpose: every card surface decides from this flag
 * whether to link the author's profile, so a read that computes it differently
 * de-anonymizes a submitter on that one surface. A profile can carry several
 * `profileUsers`; any anonymous one makes the author anonymous.
 */
export function isAnonymousAuthor(
  profileUsers?: Array<{ authUser: { isAnonymous: boolean } | null }> | null,
): boolean {
  return Boolean(profileUsers?.some((pu) => pu.authUser?.isAnonymous));
}
