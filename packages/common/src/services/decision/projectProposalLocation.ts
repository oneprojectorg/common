import { isAnonymousAuthor } from './proposalAuthor';
import { parseProposalData } from './proposalDataSchema';

/** A v2 relational `with` branch can arrive as the row or a one-element array. */
type MaybeSingle<T> = T | T[] | null | undefined;

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
