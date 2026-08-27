import { invalidate } from '@op/cache';
import { db } from '@op/db/client';
import { attachments, posts, postsToProfiles } from '@op/db/schema';
import { Events, event } from '@op/events';
import { logger } from '@op/logging';
import { CreatePostInput } from '@op/types';
import { waitUntil } from '@vercel/functions';
import { eq } from 'drizzle-orm';

import { CommonError } from '../../utils';
import { getCurrentProfileId } from '../access';
import { assertPostWriteAccess } from './access';
import { resolvePostRoots } from './resolvePostRoots';

interface CreatePostServiceInput extends CreatePostInput {
  authUserId: string;
}

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

  // Access gate: must pass before any row is written. Dispatches by the
  // root profile type — DECISION via the existing announcement/comment
  // split, ORG comments via walled-garden membership, INDIVIDUAL/USER
  // deny-by-default (no individual-post surface yet).
  await assertPostWriteAccess({
    user: { id: authUserId },
    rootProfileId,
    rootPostId,
    targetProfileId,
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
      // Async moderation pass. Covers posts and comments alike. Isolated from
      // the notification sends below so a failure on one side never suppresses
      // the other.
      try {
        await event.send({
          name: Events.contentSubmitted.name,
          data: {
            itemType: 'post',
            itemId: newPost.id,
          },
        });
      } catch (error) {
        logger.error('Failed to submit post for moderation review', { error });
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
        logger.error('Failed to enqueue notification event', { error });
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
    likeCount: 0,
    userHasLiked: false,
    likeUsers: [],
    commentCount: 0,
  };
};
