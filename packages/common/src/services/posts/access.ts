import { db } from '@op/db/client';
import { EntityType, organizations, postsToOrganizations } from '@op/db/schema';
import type { AccessZonePermission } from 'access-zones';
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
  rootProfileId: string;
}): AccessZonePermission => {
  if (targetProfileId && targetProfileId === rootProfileId) {
    return { decisions: permission.ADMIN };
  }
  return { decisions: decisionPermission.SUBMIT_PROPOSALS };
};

// Asserts a caller's WRITE access to a profile's posts, dispatching on the
// profile's server-resolved type. Fail-closed: any type without an explicit
// case is denied. Mirrors {@link assertPostReadAccess} but the per-type rules
// are different (an outsider reading a public decision is fine; writing on it
// still needs SUBMIT_PROPOSALS).
//
// Proposal targets never reach this dispatch — `resolvePostRoots` walks them
// up to the parent decision before the gate runs, so a write on a proposal
// profile lands here with `rootProfileId` = parent decision.
//
// Legacy `postsToOrganizations` posts have `rootProfileId === null`. Comments
// under such a post inherit the null and resolve the gating org through the
// thread root's `postsToOrganizations` row instead.
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
  if (!rootProfileId) {
    // Legacy postsToOrganizations branch: the only write that can land here
    // is a reply under a legacy org-feed post (top-level writes with no
    // target/parent are not allowed). Org membership gates it the same way
    // `createPostInOrganization` does — any role on the org.
    if (!rootPostId) {
      throw new UnauthorizedError('You do not have access to write here');
    }
    const [legacyLink] = await db
      .select({ organizationId: postsToOrganizations.organizationId })
      .from(postsToOrganizations)
      .where(eq(postsToOrganizations.postId, rootPostId))
      .limit(1);
    if (!legacyLink) {
      throw new UnauthorizedError('You do not have access to write here');
    }
    const orgUser = await getOrgAccessUser({
      user,
      organizationId: legacyLink.organizationId,
    });
    if (!orgUser) {
      throw new UnauthorizedError('You do not have access to write here');
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

  switch (profile.type) {
    case EntityType.DECISION: {
      await assertProfileTypeAccess({
        user,
        profileIds: [rootProfileId],
        policies: {
          [EntityType.DECISION]: getDecisionPostPermission({
            targetProfileId,
            rootProfileId,
          }),
        },
      });
      return;
    }

    // Org-feed writes split by shape — the same admin-vs-member split used
    // by decisions. A top-level update *on the org profile itself*
    // (announcement) requires `profile: ADMIN` (resolved via the org-admin
    // fallback, since org roles live on `organizationUsers`, not
    // `profileUsers`). Comments under an existing org post are open to any
    // org member — that's the legacy org-feed engagement model and matches
    // the decision SUBMIT_PROPOSALS split.
    case EntityType.ORG: {
      const isOrgAnnouncement =
        targetProfileId !== null &&
        targetProfileId !== undefined &&
        targetProfileId === rootProfileId;

      if (isOrgAnnouncement) {
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
      if (!org?.id) {
        throw new UnauthorizedError('You do not have access to write here');
      }
      const orgUser = await getOrgAccessUser({
        user,
        organizationId: org.id,
      });
      if (!orgUser) {
        throw new UnauthorizedError('You do not have access to write here');
      }
      return;
    }

    default:
      // INDIVIDUAL / USER fall here. Individual-profile posting isn't a
      // supported surface yet, so deny rather than leak a lenient pass.
      throw new UnauthorizedError('You do not have access to write here');
  }
};
