import { db } from '@op/db/client';
import { EntityType, postsToOrganizations } from '@op/db/schema';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { NotFoundError, UnauthorizedError } from '../../utils';
import {
  type AccessUser,
  assertInstanceProfileAccess,
  assertProfileTypeAccess,
  getUserSession,
} from '../access';
import { decisionPermission } from '../decision/permissions';
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

const WRITE_DENIED = 'You do not have access to write here';

// Asserts the caller is inside the walled garden (a network email domain
// or an allow-list entry). Org-post comments are gated on this — anyone in
// the walled garden can comment on any org post, regardless of per-org
// membership. Fails closed when the caller has no resolvable email
// (anonymous / sentinel callers).
const assertOnWalledGarden = async (user: AccessUser | undefined) => {
  if (!user?.id) {
    throw new UnauthorizedError(WRITE_DENIED);
  }
  const session = await getUserSession({ authUserId: user.id });
  const isMember = await getNetworkMembership(session?.user?.email);
  if (!isMember) {
    throw new UnauthorizedError(WRITE_DENIED);
  }
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
}: {
  user: AccessUser | undefined;
  rootProfileId: string | null;
  rootPostId: string | null;
  targetProfileId?: string | null;
}) => {
  // Legacy postsToOrganizations branch: the only write that lands here is
  // a reply under a legacy org-feed post. Same walled-garden gate as the
  // modern ORG comment path below — the legacy postsToOrganizations row
  // is only used to confirm the thread actually belongs to *some* org.
  if (!rootProfileId) {
    if (!rootPostId) {
      throw new UnauthorizedError(WRITE_DENIED);
    }
    const [legacyLink] = await db
      .select({ organizationId: postsToOrganizations.organizationId })
      .from(postsToOrganizations)
      .where(eq(postsToOrganizations.postId, rootPostId))
      .limit(1);
    if (!legacyLink) {
      throw new UnauthorizedError(WRITE_DENIED);
    }
    await assertOnWalledGarden(user);
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
      await assertOnWalledGarden(user);
      return;

    // INDIVIDUAL / USER profiles aren't a supported posting surface yet.
    default:
      throw new UnauthorizedError(WRITE_DENIED);
  }
};
