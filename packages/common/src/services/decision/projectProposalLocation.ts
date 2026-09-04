import { isAnonymousAuthor } from './proposalAuthor';
import { parseProposalData } from './proposalDataSchema';

/** A v2 relational `with` branch can arrive as the row or a one-element array. */
type MaybeSingle<T> = T | T[] | null | undefined;

type AuthorProfileUsers = Parameters<typeof isAnonymousAuthor>[0];

/**
 * The columns a pin needs. Shared so the two pin reads select the same set and
 * therefore project identically.
 */
export const proposalLocationColumns = {
  id: true,
  processInstanceId: true,
  proposalData: true,
  status: true,
  visibility: true,
  profileId: true,
  submittedByProfileId: true,
} satisfies Record<string, true>;

/**
 * The relations a pin's marker and hovercard read. `profileUsers` is not
 * optional: without it `isAnonymousAuthor` sees no rows, every author folds to
 * "not anonymous", and the hovercard links a profile it should not.
 */
export const proposalLocationWith = {
  submittedBy: {
    with: {
      avatarImage: true,
      profileUsers: {
        columns: {},
        with: { authUser: { columns: { isAnonymous: true } } },
      },
    },
  },
  profile: true,
} as const;

/**
 * Turns one proposal row into the map's pin shape, or nothing when it has no
 * coordinates — drafts and unlocated proposals never render a pin. Returns an
 * array so callers `flatMap` it.
 *
 * Shared by `listProposalLocations` (every located proposal in scope) and
 * `listReviewAssignmentLocations` (only the caller's own assignments): the two
 * reads answer different questions but must hand the map the same `Proposal`
 * shape, and the anonymity fold is the part that must not drift — miss it and
 * an anonymous author's profile gets linked from the hovercard.
 */
export const projectProposalLocation = <
  TAuthor extends { profileUsers: AuthorProfileUsers },
  TProfile,
>(row: {
  id: string;
  processInstanceId: string;
  proposalData: unknown;
  // Nullable on the row, and passed through untouched — the response schema at
  // the router boundary is what narrows them.
  status: string | null;
  visibility: string | null;
  profileId: string;
  submittedBy: MaybeSingle<TAuthor>;
  profile: MaybeSingle<TProfile>;
}) => {
  const proposalData = parseProposalData(row.proposalData);
  if (!proposalData.location) {
    return [];
  }

  const rawSubmittedBy = single(row.submittedBy);
  const submittedBy = rawSubmittedBy
    ? (() => {
        const { profileUsers, ...author } = rawSubmittedBy;
        return { ...author, isAnonymous: isAnonymousAuthor(profileUsers) };
      })()
    : rawSubmittedBy;

  return [
    {
      id: row.id,
      processInstanceId: row.processInstanceId,
      proposalData,
      status: row.status,
      visibility: row.visibility,
      profileId: row.profileId,
      submittedBy,
      profile: single(row.profile),
    },
  ];
};

const single = <T>(value: MaybeSingle<T>): T | null | undefined =>
  Array.isArray(value) ? value[0] : value;
