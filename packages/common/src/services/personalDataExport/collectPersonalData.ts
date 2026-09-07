import { and, asc, db, eq, inArray, isNull, or } from '@op/db/client';
import {
  attachments,
  customFormSubmissions,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  individuals,
  postReactions,
  posts,
  profiles,
  proposals,
  users,
} from '@op/db/schema';
import { logger } from '@op/logging';

import { NotFoundError } from '../../utils';
import { PERSONAL_DATA_EXPORT_MAX_ROWS_PER_SECTION } from './constants';
import type { PersonalDataExportSection } from './schemas';

/**
 * The file one personal data export produces.
 *
 * Article 20 covers the data the subject *provided*, so this holds what they
 * wrote, submitted, uploaded, and chose. It deliberately holds no analytics, no
 * inferred attributes, and no moderation verdicts — those are data we derived
 * about them, which the right does not reach.
 *
 * Every collection is the subject's own rows. A post they wrote is theirs; the
 * thread it sits in is not, so a reply carries its parent's id and none of its
 * parent's content.
 */
export interface PersonalDataExportFile {
  /** When the read that produced this file started, as an ISO string. */
  exportedAt: string;
  /** The subject's account. */
  user: SubjectUser;
  /**
   * The subject's personal profile, or null when they never completed one.
   *
   * Null is a real state, not a failure: a `users` row exists from the moment an
   * auth user is created, and the profile arrives at onboarding. Every
   * collection below is scoped to this profile, so a null here means the export
   * is the account alone.
   */
  profile: SubjectProfile | null;
  /** The individual record attached to the profile, when one exists. */
  individual: SubjectIndividual | null;
  posts: SubjectPost[];
  postReactions: SubjectPostReaction[];
  proposals: SubjectProposal[];
  /**
   * Attachment records the subject uploaded. Metadata only — the file bytes are
   * not in this export, and the record names each file so a subject can ask for
   * one.
   */
  attachments: SubjectAttachment[];
  customFormSubmissions: SubjectCustomFormSubmission[];
  voteSubmissions: SubjectVoteSubmission[];
  /**
   * Sections the row ceiling cut short. Empty on a complete export.
   *
   * In the file rather than only on the export record, because the record lives
   * for a day and the file outlives it. The person holding an incomplete file is
   * the one who needs to know it is incomplete.
   */
  truncatedSections: PersonalDataExportSection[];
}

export interface SubjectUser {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  about: string | null;
  title: string | null;
  tos: boolean | null;
  privacy: boolean | null;
  tosAcceptedOn: string | null;
  privacyAcceptedOn: string | null;
  onboardedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SubjectProfile {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  mission: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SubjectIndividual {
  pronouns: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SubjectPost {
  id: string;
  content: string;
  /** Post this one replies to. The parent's content is not the subject's. */
  parentPostId: string | null;
  /** Top-level post of the thread this one sits in. */
  rootPostId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SubjectPostReaction {
  postId: string;
  reactionType: string;
  createdAt: string | null;
}

export interface SubjectProposal {
  id: string;
  processInstanceId: string;
  /** The proposal itself, as submitted. */
  proposalData: unknown;
  status: string | null;
  visibility: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SubjectAttachment {
  id: string;
  postId: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  createdAt: string | null;
}

export interface SubjectCustomFormSubmission {
  id: string;
  customFormId: string;
  /**
   * The entity the submission is filed against — the subject's own profile, or
   * the profile of a proposal they submitted.
   */
  profileId: string;
  data: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SubjectVoteSubmission {
  id: string;
  processInstanceId: string;
  voteData: unknown;
  customData: Record<string, unknown> | null;
  /**
   * The proposals this vote selected.
   *
   * Read from the join table, not from `voteData`. `voteData` records the schema
   * version, a timestamp, and a signature — it does not hold the choice. A vote
   * export without this list would be a record that someone voted with no record
   * of what for.
   */
  selectedProposalIds: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Read everything a personal data export covers for one data subject.
 *
 * Scope is settled here, not by the caller: the subject is named by their auth
 * user id, and every collection is scoped to the personal profile that
 * `users.profileId` points at. No parameter widens that. A caller cannot ask for
 * someone else's data, because there is nothing to ask with.
 *
 * "Their personal profile" is a real limit, and the sharpest edge of this export.
 * Most writers attribute a row to `getCurrentProfileId` — the profile the person
 * last switched to — so someone who posts or submits a proposal while acting as
 * an organisation writes it under the organisation's profile, and it stays out
 * of this file. (Voting is the exception: it attributes to
 * `getIndividualProfileId`, which is this same personal profile.)
 *
 * Widening to every profile they can act as is not the fix. An organisation's
 * profile is shared by its members, and no column records which human wrote an
 * organisation-attributed row — so including those rows would hand one member
 * their colleagues' work. Excluding them is both the only safe reading and the
 * defensible one: what someone writes on an organisation's behalf is the
 * organisation's record.
 *
 * Soft-deleted rows stay out. The subject deleted them, and a moderation
 * takedown (`moderationDetachedAt`) is invisible to everyone including admins;
 * handing either back in an export would undo the deletion it records.
 *
 * Reads run concurrently. Each is indexed on the profile id, and none depends on
 * another's result.
 *
 * @param authUserId - The data subject, taken from the authenticated session by
 *   the caller. Never from client input.
 * @returns The complete file, including the list of sections the row ceiling cut
 *   short.
 * @throws NotFoundError when no `users` row matches the auth user id.
 */
export const collectPersonalData = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<PersonalDataExportFile> => {
  const exportedAt = new Date().toISOString();

  const [account] = await db
    .select({
      id: users.id,
      profileId: users.profileId,
      name: users.name,
      username: users.username,
      email: users.email,
      about: users.about,
      title: users.title,
      tos: users.tos,
      privacy: users.privacy,
      tosAcceptedOn: users.tosAcceptedOn,
      privacyAcceptedOn: users.privacyAcceptedOn,
      onboardedAt: users.onboardedAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);

  if (!account) {
    throw new NotFoundError('User', authUserId);
  }

  const { profileId, ...user } = account;

  // No personal profile means no authored content to scope. Returning early
  // keeps every collection query from running against a null profile id, and the
  // empty collections below are the honest answer rather than a degraded one.
  if (!profileId) {
    return {
      exportedAt,
      user,
      profile: null,
      individual: null,
      posts: [],
      postReactions: [],
      proposals: [],
      attachments: [],
      customFormSubmissions: [],
      voteSubmissions: [],
      truncatedSections: [],
    };
  }

  const [
    profile,
    individual,
    subjectPosts,
    subjectReactions,
    subjectProposals,
    subjectAttachments,
    subjectFormSubmissions,
    subjectVotes,
  ] = await Promise.all([
    readProfile(profileId),
    readIndividual(profileId),
    readPosts(profileId),
    readPostReactions(profileId),
    readProposals(profileId),
    readAttachments(profileId),
    readCustomFormSubmissions(profileId),
    readVoteSubmissions(profileId),
  ]);

  const sections = [
    subjectPosts,
    subjectReactions,
    subjectProposals,
    subjectAttachments,
    subjectFormSubmissions,
    subjectVotes,
  ];

  return {
    exportedAt,
    user,
    profile,
    individual,
    posts: subjectPosts.rows,
    postReactions: subjectReactions.rows,
    proposals: subjectProposals.rows,
    attachments: subjectAttachments.rows,
    customFormSubmissions: subjectFormSubmissions.rows,
    voteSubmissions: subjectVotes.rows,
    truncatedSections: sections
      .filter(({ truncated }) => truncated)
      .map(({ section }) => section),
  };
};

/** One collection, plus whether the row ceiling cut it short. */
interface CollectedSection<T> {
  section: PersonalDataExportSection;
  rows: T[];
  truncated: boolean;
}

/**
 * Run one section's query with the row ceiling applied, and report whether it
 * bound.
 *
 * The query asks for one row past the ceiling. That extra row is the only way to
 * tell "exactly at the ceiling" from "more than the ceiling" without a second
 * count query, and reporting the first as truncated would put a false warning on
 * a complete file.
 *
 * @param section - Which collection this is. Travels into `truncatedSections`.
 * @param read - Runs the query with the given limit.
 */
const collectSection = async <T>({
  section,
  read,
}: {
  section: PersonalDataExportSection;
  read: (limit: number) => Promise<T[]>;
}): Promise<CollectedSection<T>> => {
  const rows = await read(PERSONAL_DATA_EXPORT_MAX_ROWS_PER_SECTION + 1);

  if (rows.length <= PERSONAL_DATA_EXPORT_MAX_ROWS_PER_SECTION) {
    return { section, rows, truncated: false };
  }

  logger.warn('Personal data export section truncated at the row ceiling', {
    section,
    ceiling: PERSONAL_DATA_EXPORT_MAX_ROWS_PER_SECTION,
  });

  return {
    section,
    rows: rows.slice(0, PERSONAL_DATA_EXPORT_MAX_ROWS_PER_SECTION),
    truncated: true,
  };
};

const readProfile = async (
  profileId: string,
): Promise<SubjectProfile | null> => {
  const [profile] = await db
    .select({
      id: profiles.id,
      name: profiles.name,
      slug: profiles.slug,
      bio: profiles.bio,
      mission: profiles.mission,
      email: profiles.email,
      phone: profiles.phone,
      website: profiles.website,
      address: profiles.address,
      city: profiles.city,
      state: profiles.state,
      postalCode: profiles.postalCode,
      createdAt: profiles.createdAt,
      updatedAt: profiles.updatedAt,
    })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  return profile ?? null;
};

const readIndividual = async (
  profileId: string,
): Promise<SubjectIndividual | null> => {
  const [individual] = await db
    .select({
      pronouns: individuals.pronouns,
      createdAt: individuals.createdAt,
      updatedAt: individuals.updatedAt,
    })
    .from(individuals)
    .where(eq(individuals.profileId, profileId))
    .limit(1);

  return individual ?? null;
};

// Every collection below orders by `createdAt` then `id`. The timestamp alone is
// not unique, so two rows written in the same tick would order arbitrarily and
// two exports of unchanged data would differ.
const readPosts = (profileId: string) =>
  collectSection<SubjectPost>({
    section: 'posts',
    read: (limit) =>
      db
        .select({
          id: posts.id,
          content: posts.content,
          parentPostId: posts.parentPostId,
          rootPostId: posts.rootPostId,
          createdAt: posts.createdAt,
          updatedAt: posts.updatedAt,
        })
        .from(posts)
        .where(and(eq(posts.profileId, profileId), isNull(posts.deletedAt)))
        .orderBy(asc(posts.createdAt), asc(posts.id))
        .limit(limit),
  });

const readPostReactions = (profileId: string) =>
  collectSection<SubjectPostReaction>({
    section: 'postReactions',
    read: (limit) =>
      db
        .select({
          postId: postReactions.postId,
          reactionType: postReactions.reactionType,
          createdAt: postReactions.createdAt,
        })
        .from(postReactions)
        .where(
          and(
            eq(postReactions.profileId, profileId),
            isNull(postReactions.deletedAt),
          ),
        )
        .orderBy(asc(postReactions.createdAt), asc(postReactions.id))
        .limit(limit),
  });

/**
 * The proposals this subject submitted, as a reusable condition.
 *
 * Two readers need it: the proposals section, and the custom form submissions
 * that are filed against those proposals' profiles. One definition keeps the two
 * from drifting — a submission whose proposal is deleted must not travel while
 * the proposal itself does not.
 */
const submittedProposals = (profileId: string) =>
  and(
    eq(proposals.submittedByProfileId, profileId),
    isNull(proposals.deletedAt),
    isNull(proposals.moderationDetachedAt),
  );

const readProposals = (profileId: string) =>
  collectSection<SubjectProposal>({
    section: 'proposals',
    read: (limit) =>
      db
        .select({
          id: proposals.id,
          processInstanceId: proposals.processInstanceId,
          proposalData: proposals.proposalData,
          status: proposals.status,
          visibility: proposals.visibility,
          createdAt: proposals.createdAt,
          updatedAt: proposals.updatedAt,
        })
        .from(proposals)
        .where(submittedProposals(profileId))
        .orderBy(asc(proposals.createdAt), asc(proposals.id))
        .limit(limit),
  });

const readAttachments = (profileId: string) =>
  collectSection<SubjectAttachment>({
    section: 'attachments',
    read: (limit) =>
      db
        .select({
          id: attachments.id,
          postId: attachments.postId,
          fileName: attachments.fileName,
          mimeType: attachments.mimeType,
          fileSize: attachments.fileSize,
          createdAt: attachments.createdAt,
        })
        .from(attachments)
        .where(
          and(
            eq(attachments.profileId, profileId),
            isNull(attachments.deletedAt),
          ),
        )
        .orderBy(asc(attachments.createdAt), asc(attachments.id))
        .limit(limit),
  });

/**
 * The subject's custom form submissions.
 *
 * `custom_form_submissions.profileId` is the *target* entity's profile, not the
 * submitter's: a proposal idea submission is filed under the proposal's own
 * profile. Reading only `profileId = <subject>` would therefore return the forms
 * attached to their profile and miss every form they filled in to submit a
 * proposal, which is the bulk of what they wrote.
 *
 * The subquery is what keeps that widening honest. It reaches only the profiles
 * of proposals this subject submitted, so a form filed against someone else's
 * proposal stays out.
 */
const readCustomFormSubmissions = (profileId: string) =>
  collectSection<SubjectCustomFormSubmission>({
    section: 'customFormSubmissions',
    read: (limit) =>
      db
        .select({
          id: customFormSubmissions.id,
          customFormId: customFormSubmissions.customFormId,
          profileId: customFormSubmissions.profileId,
          data: customFormSubmissions.data,
          createdAt: customFormSubmissions.createdAt,
          updatedAt: customFormSubmissions.updatedAt,
        })
        .from(customFormSubmissions)
        .where(
          and(
            or(
              eq(customFormSubmissions.profileId, profileId),
              inArray(
                customFormSubmissions.profileId,
                db
                  .select({ profileId: proposals.profileId })
                  .from(proposals)
                  .where(submittedProposals(profileId)),
              ),
            ),
            isNull(customFormSubmissions.deletedAt),
          ),
        )
        .orderBy(
          asc(customFormSubmissions.createdAt),
          asc(customFormSubmissions.id),
        )
        .limit(limit),
  });

/**
 * The subject's vote submissions, each carrying the proposals it selected.
 *
 * Two queries rather than a join: one submission selects many proposals, so a
 * join would repeat every submission per selection and the row ceiling would
 * then count selections instead of votes.
 */
const readVoteSubmissions = async (
  profileId: string,
): Promise<CollectedSection<SubjectVoteSubmission>> => {
  const submissions = await collectSection({
    section: 'voteSubmissions',
    read: (limit) =>
      db
        .select({
          id: decisionsVoteSubmissions.id,
          processInstanceId: decisionsVoteSubmissions.processInstanceId,
          voteData: decisionsVoteSubmissions.voteData,
          customData: decisionsVoteSubmissions.customData,
          createdAt: decisionsVoteSubmissions.createdAt,
          updatedAt: decisionsVoteSubmissions.updatedAt,
        })
        .from(decisionsVoteSubmissions)
        .where(
          and(
            eq(decisionsVoteSubmissions.submittedByProfileId, profileId),
            isNull(decisionsVoteSubmissions.deletedAt),
          ),
        )
        .orderBy(
          asc(decisionsVoteSubmissions.createdAt),
          asc(decisionsVoteSubmissions.id),
        )
        .limit(limit),
  });

  const submissionIds = submissions.rows.map(({ id }) => id);

  // `inArray` with an empty list builds a `false` predicate in some drivers and
  // a syntax error in others. Nothing to look up either way.
  const selections = submissionIds.length
    ? await db
        .select({
          voteSubmissionId: decisionsVoteProposals.voteSubmissionId,
          proposalId: decisionsVoteProposals.proposalId,
        })
        .from(decisionsVoteProposals)
        .where(inArray(decisionsVoteProposals.voteSubmissionId, submissionIds))
        .orderBy(asc(decisionsVoteProposals.proposalId))
    : [];

  const selectedBySubmission = new Map<string, string[]>();

  for (const { voteSubmissionId, proposalId } of selections) {
    const existing = selectedBySubmission.get(voteSubmissionId);

    if (existing) {
      existing.push(proposalId);
    } else {
      selectedBySubmission.set(voteSubmissionId, [proposalId]);
    }
  }

  return {
    ...submissions,
    rows: submissions.rows.map((submission) => ({
      ...submission,
      selectedProposalIds: selectedBySubmission.get(submission.id) ?? [],
    })),
  };
};
