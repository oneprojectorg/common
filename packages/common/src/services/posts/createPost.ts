import { invalidate } from '@op/cache';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  EntityType,
  attachments,
  organizations,
  posts,
  postsToOrganizations,
  postsToProfiles,
  profiles,
} from '@op/db/schema';
import { CreatePostInput } from '@op/types';
import { waitUntil } from '@vercel/functions';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { CommonError } from '../../utils';
import { assertProfileTypeAccess, getCurrentProfileId } from '../access';
import { decisionPermission } from '../decision/permissions';
import { sendCommentNotificationEmail } from '../email';
import { resolvePostRoots } from './resolvePostRoots';

interface CreatePostServiceInput extends CreatePostInput {
  authUserId: string;
}

const sendPostCommentNotification = async (
  parentPostId: string,
  commentContent: string,
  commenterProfileId: string,
) => {
  try {
    // The parent post may be attached to an organization profile (org feed,
    // proposal comments) OR a non-org profile (decision-instance updates,
    // user profile posts). The post author is always on `posts.profileId`,
    // so we resolve the recipient there and look up the "posted in" context
    // separately (org name when org-attached, profile name otherwise).
    const [parentRow] = await db
      .select({
        post: {
          id: posts.id,
          content: posts.content,
          profileId: posts.profileId,
        },
        author: {
          id: profiles.id,
          name: profiles.name,
          email: profiles.email,
          slug: profiles.slug,
        },
      })
      .from(posts)
      .innerJoin(profiles, eq(profiles.id, posts.profileId))
      .where(eq(posts.id, parentPostId))
      .limit(1);

    if (!parentRow) {
      return;
    }

    const { post: parentPost, author: recipientProfile } = parentRow;

    // Don't notify the user about comments on their own post
    if (recipientProfile.id === commenterProfileId || !recipientProfile.email) {
      return;
    }

    const [commenterRow, parentOrgLinkRow] = await Promise.all([
      db
        .select({ name: profiles.name })
        .from(profiles)
        .where(eq(profiles.id, commenterProfileId))
        .limit(1),
      db
        .select({
          orgProfileName: profiles.name,
          orgProfileSlug: profiles.slug,
        })
        .from(postsToOrganizations)
        .innerJoin(
          organizations,
          eq(organizations.id, postsToOrganizations.organizationId),
        )
        .innerJoin(profiles, eq(profiles.id, organizations.profileId))
        .where(eq(postsToOrganizations.postId, parentPostId))
        .limit(1),
    ]);

    const commenterProfile = commenterRow[0];
    if (!commenterProfile) {
      return;
    }

    const contextName =
      parentPost.content.length > 50
        ? `${parentPost.content.slice(0, 50).trim()}...`
        : parentPost.content.trim();

    // Prefer org context for the URL/postedIn field when the parent post is
    // org-attached; otherwise fall back to the recipient (author) profile.
    const parentOrgLink = parentOrgLinkRow[0];
    const linkedProfileSlug =
      parentOrgLink?.orgProfileSlug ?? recipientProfile.slug;
    const postedIn = parentOrgLink?.orgProfileName ?? recipientProfile.name;

    const baseUrl = OPURLConfig('APP').ENV_URL;
    const contentUrl = `${baseUrl}/profile/${linkedProfileSlug}/posts/${parentPost.id}`;

    await sendCommentNotificationEmail({
      to: recipientProfile.email,
      commenterName: commenterProfile.name,
      postContent: parentPost.content,
      commentContent,
      postUrl: contentUrl,
      recipientName: recipientProfile.name,
      contentType: 'post',
      contextName,
      postedIn,
    });
  } catch (emailError) {
    console.error(
      'Failed to send post comment notification email:',
      emailError,
    );
  }
};

const sendProposalCommentNotification = async (
  proposalId: string,
  commentContent: string,
  commenterProfileId: string,
) => {
  try {
    // Get proposal and author information
    const proposal = await db.query.proposals.findFirst({
      where: { id: proposalId },
      with: {
        profile: true,
        processInstance: true,
      },
    });

    if (proposal && proposal.profileId) {
      // Parallelize commenter and proposal author queries
      const [commenterProfile, proposalAuthorProfile] = await Promise.all([
        db._query.profiles.findFirst({
          where: (table, { eq }) => eq(table.id, commenterProfileId),
        }),
        db._query.profiles.findFirst({
          where: (table, { eq }) => eq(table.id, proposal.submittedByProfileId),
        }),
      ]);

      if (
        commenterProfile &&
        proposalAuthorProfile &&
        proposalAuthorProfile.email &&
        proposal.profile
      ) {
        // Don't send notification if user is commenting on their own proposal
        if (proposal.profileId !== commenterProfileId) {
          const proposalAuthorName = proposal.profile.name || 'User';

          // For proposals, we use 'proposal' as the content type
          const contentType = 'proposal';

          const baseUrl = OPURLConfig('APP').ENV_URL;

          // Get processInstanceId for the URL
          const processInstanceId = proposal.processInstance
            ? (proposal.processInstance as any).id
            : 'unknown';

          // Get profile slug for the URL
          const profileSlug = proposal.profile.slug || 'unknown';

          const contentUrl = `${baseUrl}/profile/${profileSlug}/decisions/${processInstanceId}/proposal/${proposal.profileId}`;

          // Extract proposal content from proposalData
          const proposalContent =
            typeof proposal.proposalData === 'object' &&
            proposal.proposalData !== null
              ? (proposal.proposalData as any)?.description ||
                proposal.profile.name ||
                'Proposal content'
              : 'Proposal content';

          // Create context name from proposal title (preferred) or description
          const proposalTitle = proposal.profile.name;

          const contextName = proposalTitle
            ? proposalTitle.length > 50
              ? `${proposalTitle.slice(0, 50).trim()}...`
              : proposalTitle.trim()
            : proposalContent.length > 50
              ? `${proposalContent.slice(0, 50).trim()}...`
              : proposalContent.trim();

          // Get decision-making process name for "Posted in" field
          let postedIn = 'Unknown Process';
          if (proposal.processInstance) {
            const processInstanceData = proposal.processInstance as any;
            postedIn = processInstanceData.name || 'Decision Making Process';
          }

          await sendCommentNotificationEmail({
            to: proposalAuthorProfile.email,
            commenterName: commenterProfile.name,
            postContent: proposalContent,
            commentContent: commentContent,
            postUrl: contentUrl,
            recipientName: proposalAuthorName,
            contentType: contentType,
            contextName: contextName,
            postedIn: postedIn,
          });
        }
      }
    }
  } catch (emailError) {
    // Log email error but don't fail the post creation
    console.error(
      'Failed to send proposal comment notification email:',
      emailError,
    );
  }
};

export const createPost = async (input: CreatePostServiceInput) => {
  const {
    content,
    attachmentIds = [],
    parentPostId,
    profileId: targetProfileId,
    proposalId,
    authUserId,
  } = input;

  const profileId = await getCurrentProfileId(authUserId);

  // Resolve the access gate (rootProfileId) and thread root (rootPostId)
  // before opening the insert transaction. Both are pinned at write time so
  // read paths can dispatch on them without re-walking parents. The resolver
  // also handles the proposal → parent decision lookup, so rootProfileId is
  // always the *correct* gate (decision/org/individual), never a proposal.
  const { rootProfileId, rootPostId } = await resolvePostRoots({
    targetProfileId,
    parentPostId,
  });

  // Authorize against the resolved gate. Decision profiles get a
  // decision-permission gate; top-level posts (targetProfileId set) require
  // ADMIN, comments (parentPostId only) require SUBMIT_PROPOSALS. Org and
  // individual profile types fall through (no policy = lenient — callers on
  // those paths layer their own membership checks).
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: rootProfileId ? [rootProfileId] : [],
    policies: {
      [EntityType.DECISION]: targetProfileId
        ? { decisions: permission.ADMIN }
        : { decisions: decisionPermission.SUBMIT_PROPOSALS },
    },
  });

  // postsToProfiles inheritance for comments — separate concern from auth
  // (which now uses rootProfileId). This stays as the feed/discovery index.
  const parentProfiles =
    !targetProfileId && parentPostId
      ? await db
          .select({ profileId: postsToProfiles.profileId })
          .from(postsToProfiles)
          .where(eq(postsToProfiles.postId, parentPostId))
      : [];

  try {
    const newPost = await db.transaction(async (tx) => {
      // Get all storage objects that were attached to the post (inside transaction)
      const allStorageObjects =
        attachmentIds.length > 0
          ? await tx._query.objectsInStorage.findMany({
              where: (table, { inArray }) => inArray(table.id, attachmentIds),
            })
          : [];

      // If parentPostId is provided, verify the parent post exists (inside transaction)
      if (parentPostId) {
        const parentPost = await tx
          .select({ id: posts.id })
          .from(posts)
          .where(eq(posts.id, parentPostId))
          .limit(1);

        if (parentPost.length === 0) {
          throw new CommonError('Parent post not found');
        }
      }
      // Create the post
      const [newPost] = await tx
        .insert(posts)
        .values({
          content,
          parentPostId: parentPostId || null,
          profileId,
          rootProfileId,
          rootPostId,
        })
        .returning();

      if (!newPost) {
        throw new CommonError('Failed to create post');
      }

      // If targetProfileId is provided, create the profile association
      if (targetProfileId) {
        await tx.insert(postsToProfiles).values({
          postId: newPost.id,
          profileId: targetProfileId,
        });
      } else if (parentPostId) {
        // For comments (posts with parentPostId), inherit profile associations from parent post.
        if (parentProfiles.length > 0) {
          await tx.insert(postsToProfiles).values(
            parentProfiles.map((profile) => ({
              postId: newPost.id,
              profileId: profile.profileId,
            })),
          );
        }
      } else {
        throw new CommonError('Failed to create post');
      }

      // Create attachment records if any attachments were uploaded
      if (allStorageObjects.length > 0) {
        const attachmentValues = allStorageObjects.map((storageObject) => ({
          postId: newPost.id,
          storageObjectId: storageObject.id,
          profileId,
          fileName:
            storageObject?.name
              ?.split('/')
              .slice(-1)[0]
              ?.split('_')
              .slice(1)
              .join('_') ?? '',
          mimeType: (storageObject.metadata as { mimetype: string }).mimetype,
        }));

        await tx.insert(attachments).values(attachmentValues);
      }

      return newPost;
    });

    // Send notification email based on the type of comment
    // TODO: Use the message queue for this and remove @vercel/functions as a dependency in @op/common
    waitUntil(
      (async () => {
        try {
          if (parentPostId) {
            // This is a reply to an existing post/comment
            await sendPostCommentNotification(parentPostId, content, profileId);
          } else if (targetProfileId && proposalId) {
            // This is a comment on a proposal
            await sendProposalCommentNotification(
              proposalId,
              content,
              profileId,
            );
          }
        } catch (error) {
          // Log notification errors but don't fail the post creation
          console.error('Failed to send notification email:', error);
        }
      })(),
    );

    // Invalidate cache for the target profile if this is a profile-associated post (like a proposal comment)
    if (targetProfileId) {
      await invalidate({
        type: 'profile',
        params: [targetProfileId],
      });
    }

    return {
      ...newPost,
      reactionCounts: {},
      userReactions: [],
      commentCount: 0,
    };
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};
