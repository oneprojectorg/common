import { and, count, db, eq } from '@op/db/client';
import type { ProcessInstance, Proposal } from '@op/db/schema';
import {
  ProfileRelationshipType,
  organizations,
  posts,
  postsToProfiles,
  processInstances,
  profileRelationships,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { createSBServiceClient } from '@op/supabase/server';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { parseProposalData } from './proposalDataSchema';

export const getProposal = async ({
  profileId,
  user,
}: {
  profileId: string;
  user: User;
}) => {
  const dbUser = await assertUserByAuthId(user.id);

  if (!dbUser.currentProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const proposal = await db.query.proposals.findFirst({
    where: {
      profileId,
    },
    with: {
      processInstance: true,
      submittedBy: {
        with: {
          avatarImage: true,
        },
      },
      profile: true,
      attachments: {
        with: {
          attachment: {
            with: {
              storageObject: true,
            },
          },
          uploader: true,
        },
      },
    },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal not found');
  }

  // Run engagement counts and document fetch in parallel
  const [engagementCounts, documentContentMap] = await Promise.all([
    // Get engagement counts if proposal has a profile
    proposal.profileId
      ? Promise.all([
          // Get comment count
          db
            .select({ count: count() })
            .from(posts)
            .innerJoin(postsToProfiles, eq(posts.id, postsToProfiles.postId))
            .where(eq(postsToProfiles.profileId, proposal.profileId)),

          // Get likes count
          db
            .select({ count: count() })
            .from(profileRelationships)
            .where(
              and(
                eq(profileRelationships.targetProfileId, proposal.profileId),
                eq(
                  profileRelationships.relationshipType,
                  ProfileRelationshipType.LIKES,
                ),
              ),
            ),

          // Get followers count
          db
            .select({ count: count() })
            .from(profileRelationships)
            .where(
              and(
                eq(profileRelationships.targetProfileId, proposal.profileId),
                eq(
                  profileRelationships.relationshipType,
                  ProfileRelationshipType.FOLLOWING,
                ),
              ),
            ),
        ]).then(([comments, likes, followers]) => ({
          commentsCount: Number(comments[0]?.count || 0),
          likesCount: Number(likes[0]?.count || 0),
          followersCount: Number(followers[0]?.count || 0),
        }))
      : Promise.resolve({ commentsCount: 0, likesCount: 0, followersCount: 0 }),

    // Fetch document content
    getProposalDocumentsContent([
      { id: proposal.id, proposalData: proposal.proposalData },
    ]),
  ]);

  // TODO: Add access control - check if user can view this proposal
  // For now, any authenticated user can view any proposal

  // Generate signed URLs for attachments
  let attachmentsWithUrls = proposal.attachments ?? [];

  if (attachmentsWithUrls.length > 0) {
    const supabase = createSBServiceClient();

    attachmentsWithUrls = await Promise.all(
      attachmentsWithUrls.map(async (pa) => {
        const storagePath = pa.attachment?.storageObject?.name;
        if (!storagePath) {
          return pa;
        }

        const { data } = await supabase.storage
          .from('assets')
          .createSignedUrl(storagePath, 60 * 60 * 24);

        return {
          ...pa,
          attachment: pa.attachment
            ? { ...pa.attachment, url: data?.signedUrl }
            : pa.attachment,
        };
      }),
    );
  }

  return {
    ...proposal,
    proposalData: parseProposalData(proposal.proposalData),
    ...engagementCounts,
    documentContent: documentContentMap.get(proposal.id),
    attachments: attachmentsWithUrls,
  };
};

export const getPermissionsOnProposal = async ({
  user,
  proposal,
}: {
  user: User;
  proposal: Proposal & { processInstance: ProcessInstance };
}) => {
  const dbUser = await assertUserByAuthId(user.id);

  if (!dbUser.currentProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  // Check if proposal is editable by current user
  const isOwner = proposal.submittedByProfileId === dbUser.currentProfileId;
  let isEditable = isOwner;

  // Disable editing if we're in the results phase
  if (isEditable && proposal.processInstance) {
    const currentStateId = proposal.processInstance.currentStateId;
    if (currentStateId === 'results') {
      isEditable = false;
    }
  }

  // If it's not already editable, then check admin permissions to see if we can still make it editable
  if (
    !isEditable &&
    proposal.processInstance &&
    'id' in proposal.processInstance
  ) {
    // Get the organization for the process instance
    const instanceOrg = await db
      .select({
        id: organizations.id,
      })
      .from(organizations)
      .leftJoin(
        processInstances,
        eq(organizations.profileId, processInstances.ownerProfileId),
      )
      .where(eq(processInstances.id, proposal.processInstance.id))
      .limit(1);

    if (instanceOrg[0]) {
      const orgUser = await getOrgAccessUser({
        user,
        organizationId: instanceOrg[0].id,
      });

      isEditable = checkPermission(
        { decisions: permission.ADMIN },
        orgUser?.roles ?? [],
      );
    }
  }

  return isEditable;
};
