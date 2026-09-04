import { isAnonymousAuthor } from './proposalAuthor';
import { parseProposalData } from './proposalDataSchema';

type AuthorProfileUsers = Parameters<typeof isAnonymousAuthor>[0];

/** The columns a pin needs. */
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
 * The relations a pin needs. `profileUsers` feeds `isAnonymousAuthor`; without
 * it every author reads as not anonymous.
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
 * Projects one proposal row into the map's pin shape, or `[]` when it has no
 * coordinates. Shared by both pin reads so the `Proposal` shape cannot drift.
 */
export const projectProposalLocation = <
  TAuthor extends { profileUsers: AuthorProfileUsers },
  TProfile,
>(row: {
  id: string;
  processInstanceId: string;
  proposalData: unknown;
  // Nullable on the row; the router's output schema narrows them.
  status: string | null;
  visibility: string | null;
  profileId: string;
  submittedBy: TAuthor | TAuthor[] | null | undefined;
  profile: TProfile | TProfile[] | null | undefined;
}) => {
  const proposalData = parseProposalData(row.proposalData);
  if (!proposalData.location) {
    return [];
  }

  const rawSubmittedBy = Array.isArray(row.submittedBy)
    ? row.submittedBy[0]
    : row.submittedBy;
  const submittedBy = rawSubmittedBy
    ? (() => {
        const { profileUsers, ...author } = rawSubmittedBy;
        return { ...author, isAnonymous: isAnonymousAuthor(profileUsers) };
      })()
    : rawSubmittedBy;
  const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;

  return [
    {
      id: row.id,
      processInstanceId: row.processInstanceId,
      proposalData,
      status: row.status,
      visibility: row.visibility,
      profileId: row.profileId,
      submittedBy,
      profile,
    },
  ];
};
