import { db } from '@op/db/client';
import { EntityType, organizations, postsToOrganizations } from '@op/db/schema';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { NotFoundError, UnauthorizedError } from '../../utils';
import {
  type AccessUser,
  assertInstanceProfileAccess,
  assertProfileTypeAccess,
  getOrgAccessUser,
} from '../access';
import { decisionPermission } from '../decision/permissions';

// Asserts a caller's READ access to a profile's posts, dispatching on the
// profile's server-resolved type. Fail-closed: a type without a case is denied
// (unlike assertProfileTypeAccess, whose policy map passes unlisted types and
// leaked proposal posts). The type comes from the DB row, never the caller.
export const assertPostReadAccess = async ({
  user,
  profileId,
}: {
  user: AccessUser | undefined;
  profileId: string;
}) => {
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
      return;
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
      return;
    }

    default:
      throw new UnauthorizedError('You do not have access to these posts');
  }
};

const WRITE_DENIED = 'You do not have access to write here';

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
  // Legacy postsToOrganizations branch: the only write that lands here is a
  // reply under a legacy org-feed post. Org membership gates it the same
  // way `createPostInOrganization` does — any role on the org.
  if (!rootProfileId) {
    if (!rootPostId) {
      throw new UnauthorizedError(WRITE_DENIED);
    }
    const [legacyLink] = await db
      .select({ organizationId: postsToOrganizations.organizationId })
      .from(postsToOrganizations)
      .where(eq(postsToOrganizations.postId, rootPostId))
      .limit(1);
    const orgUser = legacyLink
      ? await getOrgAccessUser({
          user,
          organizationId: legacyLink.organizationId,
        })
      : undefined;
    if (!orgUser) {
      throw new UnauthorizedError(WRITE_DENIED);
    }
    return;
  }

  const profile = await db.query.profiles.findFirst({
    where: { id: rootProfileId },
    columns: { type: true },
  });

  if (!profile) {
    throw new NotFoundError('Profile', rootProfileId);
  }

  // Top-level "announcement" on the gated profile vs. comment/reply.
  // `resolvePostRoots` keeps `target === root` only for top-level writes on
  // the gated profile itself; everything else (proposal targets walked up,
  // parent-only comments) ends up with target !== root.
  const isAnnouncement =
    !!targetProfileId && targetProfileId === rootProfileId;

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
    // Comments are open to any org member — the legacy org-feed engagement
    // model and the DECISION admin/member split applied to ORG.
    case EntityType.ORG: {
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
      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.profileId, rootProfileId));
      const orgUser = org
        ? await getOrgAccessUser({ user, organizationId: org.id })
        : undefined;
      if (!orgUser) {
        throw new UnauthorizedError(WRITE_DENIED);
      }
      return;
    }

    // INDIVIDUAL / USER profiles aren't a supported posting surface yet.
    default:
      throw new UnauthorizedError(WRITE_DENIED);
  }
};
