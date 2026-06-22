import { invalidate } from '@op/cache';
import { db } from '@op/db/client';
import { EntityType, attachments, posts, postsToProfiles } from '@op/db/schema';
import { Events, event } from '@op/events';
import { CreatePostInput } from '@op/types';
import { waitUntil } from '@vercel/functions';
import type { AccessZonePermission } from 'access-zones';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { CommonError } from '../../utils';
import { assertProfileTypeAccess, getCurrentProfileId } from '../access';
import { decisionPermission } from '../decision/permissions';
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

  // Access gate: must pass before any row is written. Decision profiles get a
  // decision-permission gate via getDecisionPostPermission — see its doc for
  // the announcement-vs-comment split. Org/individual profile types fall
  // through (no policy = lenient — callers on those paths layer their own
  // membership checks).
  //
  // Content moderation is NOT a sync gate here: the post is written and shown
  // immediately, and the `content/submitted` event below drives async provider
  // review, which hides the post if a verdict comes back disallowed.
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: rootProfileId ? [rootProfileId] : [],
    policies: {
      [EntityType.DECISION]: getDecisionPostPermission({
        targetProfileId,
        rootProfileId,
      }),
    },
  });

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
            await event.send({
              name: Events.commentPosted.name,
              data: {
                postId: newPost.id,
                parentPostId: parentPostId!,
                authorProfileId: profileId,
              },
            });
            break;
          case 'proposalComment':
            await event.send({
              name: Events.proposalCommentPosted.name,
              data: {
                postId: newPost.id,
                proposalId: proposalId!,
                authorProfileId: profileId,
              },
            });
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
        console.error('Failed to enqueue notification event:', error);
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
