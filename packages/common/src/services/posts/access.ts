import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { logger } from '@op/logging';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import {
  type AccessUser,
  assertInstanceProfileAccess,
  assertProfileTypeAccess,
  getCurrentProfileId,
  getProfileAccessRolesWithOrgFallback,
  getUserSession,
} from '../access';
import { decisionPermission } from '../decision/permissions';
import { getInstancePhases } from '../decision/schemas/instanceData';
import { areCommentsAllowed } from '../decision/utils/phaseSettings';
import { getNetworkMembership } from '../user';

export type PostReadAccess = {
  /** The proposal behind the gated profile, or null when it is a decision. */
  proposal: { id: string; processInstanceId: string } | null;
  /**
   * The profile whose admins moderate these posts — always the decision's own
   * profile, never a proposal's.
   *
   * Moderation authority belongs to the process admins alone. A proposal's
   * owner and co-authors hold `profile: ADMIN` on their *proposal* profile
   * (`createProposal` grants the global Admin role), so resolving standing
   * there would hand them every flagged comment on their own proposal — and,
   * once a merge carries comments over, on every proposal merged into it.
   * Flagged content stays hidden from them; only its own author still sees it,
   * via the author clause in `postModerationFilter`.
   */
  moderationProfileId: string;
};

// Asserts a caller's READ access to a profile's posts, dispatching on the
// profile's server-resolved type. Fail-closed: a type without a case is denied
// (unlike assertProfileTypeAccess, whose policy map passes unlisted types and
// leaked proposal posts). The type comes from the DB row, never the caller.
//
// Returns the proposal it resolved on the way, so a caller that needs it does
// not query for it a second time.
export const assertPostReadAccess = async ({
  user,
  profileId,
}: {
  user: AccessUser | undefined;
  profileId: string;
}): Promise<PostReadAccess> => {
  const profile = await db.query.profiles.findFirst({
    where: { id: profileId },
    columns: { type: true },
  });

  if (!profile) {
    throw new NotFoundError('Profile', profileId);
  }

  switch (profile.type) {
    // The READ grant lives on the decision profile itself.
    case EntityType.DECISION: {
      await assertProfileTypeAccess({
        user,
        profileIds: [profileId],
        policies: { [EntityType.DECISION]: { decisions: permission.READ } },
      });
      // The decision profile is its own moderation authority.
      return { proposal: null, moderationProfileId: profileId };
    }

    // A proposal's READ grant lives on its parent decision (the process
    // instance), never on the proposal profile — gate as getProposal does.
    case EntityType.PROPOSAL: {
      const proposal = await db.query.proposals.findFirst({
        where: { profileId },
        with: { processInstance: true },
      });

      if (!proposal) {
        throw new NotFoundError('Proposal', profileId);
      }

      await assertInstanceProfileAccess({
        user,
        instance: proposal.processInstance,
        profilePermissions: { decisions: permission.READ },
        orgFallbackPermissions: [
          { decisions: permission.READ },
          { decisions: permission.ADMIN },
        ],
      });

      // `assertInstanceProfileAccess` rejects an instance with no profile, so
      // reaching this with a null is impossible; the check is what narrows the
      // nullable column for the return.
      const moderationProfileId = proposal.processInstance.profileId;
      if (!moderationProfileId) {
        throw new UnauthorizedError('You do not have access to these posts');
      }

      return {
        proposal: {
          id: proposal.id,
          processInstanceId: proposal.processInstanceId,
        },
        moderationProfileId,
      };
    }

    default:
      throw new UnauthorizedError('You do not have access to these posts');
  }
};

/** A flagged post is NotFound to everyone but its author and its moderators. */
export const assertCanReadFlaggedPost = async ({
  post,
  user,
  moderationProfileIds,
}: {
  post: { id: string; profileId: string | null };
  user: AccessUser | undefined;
  moderationProfileIds: string[];
}) => {
  const actorProfileId = user ? await getCurrentProfileId(user.id) : null;
  // No profile is nobody's author, even of a post with no recorded author.
  if (actorProfileId != null && actorProfileId === post.profileId) {
    return;
  }

  const accessUser = user ? { id: user.id } : undefined;
  const moderationRoles = await Promise.all(
    moderationProfileIds.map((profileId) =>
      getProfileAccessRolesWithOrgFallback({ user: accessUser, profileId }),
    ),
  );
  // `[].every` is true, so an empty list must not grant moderator standing.
  const isModerator =
    moderationRoles.length > 0 &&
    moderationRoles.every((roles) =>
      checkPermission({ profile: permission.ADMIN }, roles),
    );

  if (!isModerator) {
    throw new NotFoundError('Post', post.id);
  }
};

type ResolvedInstance = {
  instanceData: unknown;
  currentStateId: string | null;
};

const WRITE_DENIED = 'You do not have access to write here';
const READ_DENIED = 'You do not have access to this post';
const COMMENTS_DISABLED = 'Comments are turned off for this phase';

const assertPhaseAllowsComments = async (
  decisionProfileId: string,
  // Non-null when `resolvePostRoots` already read the instance on its way here.
  resolvedInstance: ResolvedInstance | null,
) => {
  const instance =
    resolvedInstance ??
    (await db.query.processInstances.findFirst({
      where: { profileId: decisionProfileId },
      columns: { instanceData: true, currentStateId: true },
    }));

  // Deny rather than fall through to the permissive default: a DECISION
  // profile always has an instance, so this means the rows disagree.
  if (!instance) {
    logger.warn('Decision profile has no process instance; denying comment', {
      decisionProfileId,
    });
    throw new UnauthorizedError(WRITE_DENIED);
  }

  const allowed = areCommentsAllowed({
    phases: getInstancePhases(instance.instanceData),
    currentPhaseId: instance.currentStateId,
  });

  if (!allowed) {
    throw new UnauthorizedError(COMMENTS_DISABLED);
  }
};

// Asserts the caller is inside the walled garden (a network email domain
// or an allow-list entry). Org-post comments are gated on this — anyone in
// the walled garden can comment on any org post, regardless of per-org
// membership. Fails closed when the caller has no resolvable email
// (anonymous / sentinel callers).
const assertOnWalledGarden = async ({
  user,
  deniedMessage = WRITE_DENIED,
}: {
  user: AccessUser | undefined;
  deniedMessage?: string;
}) => {
  if (!user?.id) {
    throw new UnauthorizedError(deniedMessage);
  }
  const session = await getUserSession({ authUserId: user.id });
  const isMember = await getNetworkMembership(session?.user?.email);
  if (!isMember) {
    throw new UnauthorizedError(deniedMessage);
  }
};

const getOrgFeedThreadProfileIds = async (rootPostId: string) => {
  const links = await db.query.postsToOrganizations.findMany({
    where: { postId: rootPostId },
    columns: {},
    with: { organization: { columns: { profileId: true } } },
  });
  return links.map(({ organization }) => organization.profileId);
};

// Comments written before `rootPostId` existed have it null; threads are at
// most a post, a comment and a reply deep.
const getThreadRootPostId = async (post: {
  id: string;
  parentPostId: string | null;
  rootPostId: string | null;
}) => {
  if (post.rootPostId || !post.parentPostId) {
    return post.rootPostId ?? post.id;
  }
  const parent = await db.query.posts.findFirst({
    where: { id: post.parentPostId },
    columns: { id: true, parentPostId: true, rootPostId: true },
  });
  return parent?.rootPostId ?? parent?.parentPostId ?? post.parentPostId;
};

/** Asserts READ access to a decision, proposal or org-feed post and returns the profiles whose admins moderate it. */
export const assertPostReadAccessForPost = async ({
  user,
  post,
}: {
  user: AccessUser | undefined;
  post: {
    id: string;
    parentPostId: string | null;
    rootPostId: string | null;
    postsToProfiles: { profileId: string }[];
  };
}): Promise<{ moderationProfileIds: string[] }> => {
  if (post.postsToProfiles.length > 0) {
    const readAccesses = await Promise.all(
      post.postsToProfiles.map(({ profileId }) =>
        assertPostReadAccess({ user, profileId }),
      ),
    );
    return {
      moderationProfileIds: readAccesses.map(
        ({ moderationProfileId }) => moderationProfileId,
      ),
    };
  }

  const orgProfileIds = await getOrgFeedThreadProfileIds(
    await getThreadRootPostId(post),
  );
  if (orgProfileIds.length === 0) {
    throw new UnauthorizedError(READ_DENIED);
  }

  await assertOnWalledGarden({ user, deniedMessage: READ_DENIED });

  return { moderationProfileIds: post.parentPostId ? [] : orgProfileIds };
};

// Asserts a caller's WRITE access for a new post, dispatching on the
// server-resolved root profile type. Fail-closed: any type without an
// explicit case is denied. Proposal targets never reach this dispatch —
// `resolvePostRoots` walks them up to the parent decision first. Legacy
// `postsToOrganizations` posts arrive with `rootProfileId === null` and
// gate via the thread root's `postsToOrganizations` link.
export const assertPostWriteAccess = async ({
  user,
  rootProfileId,
  rootPostId,
  targetProfileId,
  resolvedInstance = null,
}: {
  user: AccessUser | undefined;
  rootProfileId: string | null;
  rootPostId: string | null;
  targetProfileId?: string | null;
  /** Pass `resolvePostRoots`'s instance so the comment gate doesn't re-read it. */
  resolvedInstance?: ResolvedInstance | null;
}) => {
  // Legacy postsToOrganizations branch: the only write that lands here is
  // a reply under a legacy org-feed post. Same walled-garden gate as the
  // modern ORG comment path below — the legacy postsToOrganizations row
  // is only used to confirm the thread actually belongs to *some* org.
  if (!rootProfileId) {
    if (!rootPostId) {
      throw new UnauthorizedError(WRITE_DENIED);
    }
    const orgProfileIds = await getOrgFeedThreadProfileIds(rootPostId);
    if (orgProfileIds.length === 0) {
      throw new UnauthorizedError(WRITE_DENIED);
    }
    await assertOnWalledGarden({ user });
    return;
  }

  const profile = await db.query.profiles.findFirst({
    where: { id: rootProfileId },
    columns: { type: true },
  });

  if (!profile) {
    throw new NotFoundError('Profile', rootProfileId);
  }

  // Top-level "announcement" on the gated profile vs. comment/reply. A
  // comment always has `rootPostId` set (the thread root). A real
  // announcement has no parent and writes on the gated profile itself
  // (target === root). Gating on `!rootPostId` defends against a caller
  // who sets *both* `profileId` and `parentPostId` from being routed to
  // the stricter admin gate by accident.
  const isAnnouncement =
    !rootPostId && !!targetProfileId && targetProfileId === rootProfileId;

  switch (profile.type) {
    // Decision profile: announcement requires ADMIN; comments and writes
    // resolved through the decision (including proposal-target writes that
    // resolvePostRoots walks up here) require SUBMIT_PROPOSALS.
    case EntityType.DECISION:
      await assertProfileTypeAccess({
        user,
        profileIds: [rootProfileId],
        policies: {
          [EntityType.DECISION]: isAnnouncement
            ? { decisions: permission.ADMIN }
            : { decisions: decisionPermission.SUBMIT_PROPOSALS },
        },
      });
      // After the permission check, so an unauthorized caller gets that error
      // rather than a hint about the process config.
      if (!isAnnouncement) {
        await assertPhaseAllowsComments(rootProfileId, resolvedInstance);
      }
      return;

    // Org profile: announcement requires `profile: ADMIN` (resolved via
    // the org-admin fallback, since org roles live on `organizationUsers`).
    // Comments are open to any walled-garden member — a network email
    // domain or an allow-list entry — without requiring per-org membership.
    //
    // Defense-in-depth: no UI path constructs the top-level shape on this
    // endpoint today (production goes through `organization.createPost`),
    // but admin-only here keeps the gate fail-closed against any direct
    // API construction or future refactor that routes through here.
    case EntityType.ORG:
      if (isAnnouncement) {
        await assertInstanceProfileAccess({
          user,
          instance: {
            profileId: rootProfileId,
            ownerProfileId: rootProfileId,
          },
          profilePermissions: { profile: permission.ADMIN },
          orgFallbackPermissions: { profile: permission.ADMIN },
        });
        return;
      }
      await assertOnWalledGarden({ user });
      return;

    // INDIVIDUAL / USER profiles aren't a supported posting surface yet.
    default:
      throw new UnauthorizedError(WRITE_DENIED);
  }
};
