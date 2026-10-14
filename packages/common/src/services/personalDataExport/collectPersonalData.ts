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
 * Read everything a personal data export covers for one data subject. Article 20
 * covers only what the subject provided, so there are no analytics or inferred
 * attributes here, and attachments are metadata only.
 *
 * Every collection is scoped to the subject's personal profile
 * (`users.profileId`, the profile `getIndividualProfileId` resolves). Most
 * writers attribute a row to `getCurrentProfileId` instead, so anything written
 * while acting as an organisation stays out. That is the only attribution
 * available: an organisation's profile is shared by its members and no column
 * records which of them wrote a given row, so widening would hand one member
 * their colleagues' work.
 *
 * Soft-deleted and moderation-detached rows stay out — returning them would undo
 * the deletion they record.
 */
export const collectPersonalData = async ({
  authUserId,
}: {
  authUserId: string;
}) => {
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

  // No personal profile means nothing was authored under one. The empty
  // collections are the answer, not a degraded one.
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

interface CollectedSection<T> {
  section: PersonalDataExportSection;
  rows: T[];
  truncated: boolean;
}

/**
 * Run a section's query with the row ceiling applied. It asks for one row past
 * the ceiling, which is what separates "exactly at it" from "beyond it" without
 * a second count query.
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

const readProfile = async (profileId: string) => {
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

const readIndividual = async (profileId: string) => {
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

// Every collection orders by `createdAt` then `id`: the timestamp alone is not
// unique, so two exports of unchanged data could otherwise differ.
const readPosts = (profileId: string) =>
  collectSection({
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
  collectSection({
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

// Shared by the proposals section and the form submissions filed against those
// proposals' profiles, so a deleted proposal cannot take its submissions with it.
const whereSubmittedBySubject = (profileId: string) =>
  and(
    eq(proposals.submittedByProfileId, profileId),
    isNull(proposals.deletedAt),
    isNull(proposals.moderationDetachedAt),
  );

const readProposals = (profileId: string) =>
  collectSection({
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
        .where(whereSubmittedBySubject(profileId))
        .orderBy(asc(proposals.createdAt), asc(proposals.id))
        .limit(limit),
  });

const readAttachments = (profileId: string) =>
  collectSection({
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
 * `custom_form_submissions.profileId` is the target entity's profile, not the
 * submitter's, so the form someone fills in to submit a proposal is filed under
 * the proposal. The subquery reaches those, and only for proposals this subject
 * submitted.
 */
const readCustomFormSubmissions = (profileId: string) =>
  collectSection({
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
                  .where(whereSubmittedBySubject(profileId)),
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
 * Selections come from the join table because `voteData` holds a signature, not
 * the choice. Two queries rather than a join so the row ceiling counts votes, not
 * selections.
 */
const readVoteSubmissions = async (profileId: string) => {
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
