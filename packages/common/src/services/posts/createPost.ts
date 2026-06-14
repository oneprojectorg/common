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
import { Events, event } from '@op/events';
import { CreatePostInput } from '@op/types';
import { waitUntil } from '@vercel/functions';
import type { AccessZonePermission } from 'access-zones';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { CommonError } from '../../utils';
import { assertProfileTypeAccess, getCurrentProfileId } from '../access';
import { decisionPermission } from '../decision/permissions';
import { sendCommentNotificationEmail } from '../email';
import { assertTextContentModerated } from '../moderation';
import { resolvePostRoots } from './resolvePostRoots';

interface CreatePostServiceInput extends CreatePostInput {
  authUserId: string;
}

// Decision profiles use two distinct write policies:
//
//   - A top-level update posted *on the decision profile itself* (a
//     decision-wide announcement) requires ADMIN.
//   - Every other write that resolves through the decision — a comment or
//     reply on an existing post (parentPostId set), or a top-level comment
//     on a proposal profile (proposals carry no permissions of their own;
//     resolvePostRoots walks them up to the parent decision) — only
//     requires SUBMIT_PROPOSALS.
//
// resolvePostRoots preserves the target as the root only when the target
// itself is the gated profile. Every other path (proposal target, or
// parentPostId-only) ends up with target !== root, so equality cleanly
// separates the announcement case from everything else.
const getDecisionPostPermission = ({
  targetProfileId,
  rootProfileId,
}: {
  targetProfileId: string | null | undefined;
  rootProfileId: string | null;
}): AccessZonePermission => {
  if (targetProfileId && targetProfileId === rootProfileId) {
    return { decisions: permission.ADMIN };
  }
  return { decisions: decisionPermission.SUBMIT_PROPOSALS };
};

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
        processInstance: {
          with: {
            profile: true,
          },
        },
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
          const decisionSlug = proposal.processInstance?.profile?.slug;

          if (!decisionSlug) {
            throw new CommonError(
              `Cannot build proposal comment URL: proposal ${proposalId} has no process instance or decision profile`,
            );
          }

          const contentUrl = `${baseUrl}/decisions/${decisionSlug}/proposal/${proposal.profileId}`;

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

  // getCurrentProfileId and resolvePostRoots are independent reads — run them
  // together. resolvePostRoots pins the access gate (rootProfileId) and thread
  // root (rootPostId) at write time, handling the proposal → parent-decision
  // lookup so rootProfileId is always the correct gate even when the target is
  // a proposal profile (which carries no permissions of its own).
  const [profileId, { rootProfileId, rootPostId }] = await Promise.all([
    getCurrentProfileId(authUserId),
    resolvePostRoots({
      targetProfileId,
      parentPostId,
    }),
  ]);

  // Access gate and moderation gate are independent and must both pass
  // before any row is written, so run them in parallel. Decision profiles
  // get a decision-permission gate via getDecisionPostPermission — see its
  // doc for the announcement-vs-comment split. Org/individual profile types
  // fall through (no policy = lenient — callers on those paths layer their
  // own membership checks).
  await Promise.all([
    assertProfileTypeAccess({
      user: { id: authUserId },
      profileIds: rootProfileId ? [rootProfileId] : [],
      policies: {
        [EntityType.DECISION]: getDecisionPostPermission({
          targetProfileId,
          rootProfileId,
        }),
      },
    }),
    // Block disallowed text before any row is written.
    assertTextContentModerated(content),
  ]);

  // postsToProfiles inheritance for comments is purely a feed/discovery
  // index now — auth is pinned on rootProfileId above. We still pre-read
  // parent associations to inherit them onto the comment.
  const parentProfiles =
    !targetProfileId && parentPostId
      ? await db
          .select({ profileId: postsToProfiles.profileId })
          .from(postsToProfiles)
          .where(eq(postsToProfiles.postId, parentPostId))
      : [];

  const newPost = await db.transaction(async (tx) => {
    const allStorageObjects =
      attachmentIds.length > 0
        ? await tx.query.objectsInStorage.findMany({
            where: { id: { in: attachmentIds } },
          })
        : [];

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

    if (targetProfileId) {
      await tx.insert(postsToProfiles).values({
        postId: newPost.id,
        profileId: targetProfileId,
      });
    } else if (parentPostId) {
      // Auth is pinned on rootProfileId above, so postsToProfiles is now a
      // pure feed/discovery index. Inherit every parent association.
      if (parentProfiles.length > 0) {
        await tx.insert(postsToProfiles).values(
          parentProfiles.map(({ profileId }) => ({
            postId: newPost.id,
            profileId,
          })),
        );
      }
    } else {
      throw new CommonError('Failed to create post');
    }

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

  let postKind: 'comment' | 'proposalComment' | 'decisionUpdate' | undefined;
  if (parentPostId) {
    postKind = 'comment';
  } else if (proposalId && targetProfileId) {
    postKind = 'proposalComment';
  } else if (targetProfileId) {
    postKind = 'decisionUpdate';
  }

  waitUntil(
    (async () => {
      // Async moderation pass (the sync gate already ran on write). Covers
      // posts and comments alike. Isolated from the notification sends below
      // so a failure on one side never suppresses the other.
      try {
        await event.send({
          name: Events.contentSubmitted.name,
          data: {
            itemType: 'post',
            itemId: newPost.id,
          },
        });
      } catch (error) {
        console.error('Failed to submit post for moderation review:', error);
      }

      try {
        switch (postKind) {
          case 'comment':
            await sendPostCommentNotification(
              parentPostId!,
              content,
              profileId,
            );
            break;
          case 'proposalComment':
            await sendProposalCommentNotification(
              proposalId!,
              content,
              profileId,
            );
            break;
          case 'decisionUpdate':
            await event.send({
              name: Events.decisionUpdatePosted.name,
              data: {
                postId: newPost.id,
                targetProfileId: targetProfileId!,
                authorProfileId: profileId,
              },
            });
            break;
        }
      } catch (error) {
        console.error('Failed to send notification email:', error);
      }
    })(),
  );

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
};
