import { db } from '@op/db/client';
import {
  EntityType,
  posts,
  processInstances,
  profiles,
  proposals,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';

import { CommonError } from '../../utils';

export type ResolvedPostRoots = {
  rootProfileId: string | null;
  rootPostId: string | null;
};

// Resolves the two write-time root columns for a new post:
//   - rootProfileId: the profile whose membership/permission gates read
//     access. Top-level on decision/org/individual = that profile id.
//     Top-level on a proposal = the proposal's parent decision profile id.
//     Comment/reply = inherits the parent post's rootProfileId. NULL when
//     no profile context can be resolved (caller should treat as public).
//   - rootPostId: the thread's top-level post. NULL for top-level posts.
//     For replies at any depth, points at the original top-level post.
export const resolvePostRoots = async ({
  targetProfileId,
  parentPostId,
}: {
  targetProfileId?: string | null;
  parentPostId?: string | null;
}): Promise<ResolvedPostRoots> => {
  // Comment / reply — inherit from parent post.
  if (parentPostId) {
    const [parent] = await db
      .select({
        id: posts.id,
        rootProfileId: posts.rootProfileId,
        rootPostId: posts.rootPostId,
      })
      .from(posts)
      .where(eq(posts.id, parentPostId))
      .limit(1);

    if (!parent) {
      throw new CommonError('Parent post not found');
    }

    return {
      rootProfileId: parent.rootProfileId,
      // If the parent has no rootPostId, the parent IS the thread root.
      // Otherwise propagate the parent's root so deep replies all share one.
      rootPostId: parent.rootPostId ?? parent.id,
    };
  }

  // Top-level on a profile.
  if (targetProfileId) {
    const [profile] = await db
      .select({ id: profiles.id, type: profiles.type })
      .from(profiles)
      .where(eq(profiles.id, targetProfileId))
      .limit(1);

    if (!profile) {
      throw new CommonError('Target profile not found');
    }

    // Proposals don't carry their own permissions — gate resolves up to the
    // parent decision profile.
    if (profile.type === EntityType.PROPOSAL) {
      const [parent] = await db
        .select({ decisionProfileId: processInstances.profileId })
        .from(proposals)
        .innerJoin(
          processInstances,
          eq(processInstances.id, proposals.processInstanceId),
        )
        .where(eq(proposals.profileId, profile.id))
        .limit(1);

      if (!parent?.decisionProfileId) {
        throw new CommonError('Proposal has no parent decision');
      }
      return { rootProfileId: parent.decisionProfileId, rootPostId: null };
    }

    return { rootProfileId: profile.id, rootPostId: null };
  }

  return { rootProfileId: null, rootPostId: null };
};
