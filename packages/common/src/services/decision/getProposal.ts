import { and, count, db, eq } from '@op/db/client';
import type {
  ObjectsInStorage,
  ProcessInstance,
  Profile,
  Proposal,
} from '@op/db/schema';
import {
  ProfileRelationshipType,
  posts,
  postsToProfiles,
  profileRelationships,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { createSBServiceClient } from '@op/supabase/server';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess, getProfileAccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import { generateProposalHtml } from './generateProposalHtml';
import {
  type ProposalDocumentContent,
  getProposalDocumentsContent,
} from './getProposalDocumentsContent';
import {
  type DecisionRolePermissions,
  fromDecisionBitField,
} from './permissions';
import { type ProposalData, parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';

/** Attachment with signed URL for accessing the file */
type AttachmentWithUrl = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  storageObject: ObjectsInStorage | null;
  url?: string;
};

/** Proposal attachment join record with nested attachment */
type ProposalAttachmentWithDetails = {
  id: string;
  proposalId: string;
  attachmentId: string;
  uploadedBy: string;
  attachment: AttachmentWithUrl | null;
};

export const getProposal = async ({
  profileId,
  user,
}: {
  profileId: string;
  user: User;
}): Promise<
  Omit<Proposal, 'proposalData'> & {
    proposalData: ProposalData;
    submittedBy: Profile & { avatarImage: ObjectsInStorage | null };
    processInstance: ProcessInstance;
    profile: Profile;
    commentsCount: number;
    likesCount: number;
    followersCount: number;
    proposalTemplate: Record<string, unknown> | null;
    documentContent: ProposalDocumentContent | undefined;
    htmlContent: Record<string, string> | undefined;
    attachments: ProposalAttachmentWithDetails[];
  }
> => {
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
        },
      },
    },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal not found');
  }

  // Read proposalTemplate from instanceData (new path) or processSchema (legacy path)
  const proposalTemplate = await resolveProposalTemplate(
    proposal.processInstance.instanceData as Record<string, unknown> | null,
    proposal.processInstance.processId,
  );

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
      {
        id: proposal.id,
        proposalData: proposal.proposalData,
        proposalTemplate,
      },
    ]),
  ]);

  // Check that user has read access on the instance's profile,
  // falling back to org-level access for legacy proposals
  await assertInstanceProfileAccess({
    user: { id: user.id },
    instance: proposal.processInstance,
    profilePermissions: { decisions: permission.READ },
    orgFallbackPermissions: [
      { decisions: permission.READ },
      { decisions: permission.ADMIN },
    ],
  });

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

  const documentContent = documentContentMap.get(proposal.id);

  let htmlContent: Record<string, string> | undefined;
  if (documentContent?.type === 'json') {
    htmlContent = generateProposalHtml(documentContent.fragments);
  } else if (documentContent?.type === 'html') {
    // Legacy HTML from proposalData.description — trusted content from our DB
    htmlContent = {
      default: documentContent.content,
    };
  }

  return {
    ...proposal,
    proposalData: parseProposalData(proposal.proposalData),
    proposalTemplate,
    ...engagementCounts,
    documentContent,
    htmlContent,
    attachments: attachmentsWithUrls,
  };
};

export const getPermissionsOnProposal = async ({
  user,
  proposal,
}: {
  user: User;
  proposal: Proposal & { processInstance: ProcessInstance };
}): Promise<{ access: DecisionRolePermissions }> => {
  const dbUser = await assertUserByAuthId(user.id);

  if (!dbUser.currentProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  // Fetch the user's roles on the proposal's profile
  const profileUser = await getProfileAccessUser({
    user,
    profileId: proposal.profileId,
  });

  const roles = profileUser?.roles ?? [];

  // Compute decision access from combined role bitfields
  const combinedDecisionBits = roles.reduce(
    (bits, role) => bits | (role.access.decisions ?? 0),
    0,
  );
  const access = fromDecisionBitField(combinedDecisionBits);

  // Fold profile-level admin into the access.admin field
  const isProfileAdmin = checkPermission({ profile: permission.ADMIN }, roles);
  if (isProfileAdmin) {
    access.admin = true;
  }

  return { access };
};
