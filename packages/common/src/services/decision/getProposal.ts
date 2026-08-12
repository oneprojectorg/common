import { and, count, db, eq, isNull } from '@op/db/client';
import type {
  ObjectsInStorage,
  ProcessInstance,
  Profile,
  Proposal,
} from '@op/db/schema';
import {
  ProfileRelationshipType,
  ProposalStatus,
  Visibility,
  posts,
  postsToProfiles,
  profileRelationships,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { createSBServiceClient } from '@op/supabase/server';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertInstanceProfileAccess, getProfileAccessRoles } from '../access';
import { hasActiveModerationFlag } from '../moderation/moderationVisibility';
import { generateProposalHtml } from './generateProposalHtml';
import {
  type ProposalDocumentContent,
  getProposalDocumentsContent,
} from './getProposalDocumentsContent';
import {
  type DecisionRolePermissions,
  decisionPermission,
  fromDecisionBitField,
} from './permissions';
import { type ProposalData, parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { DecisionInstanceData } from './schemas/instanceData';
import { ProposalTemplateSchema } from './types';
import { isPostSubmissionEditingAllowed } from './utils/phaseSettings';

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
  user: User | undefined;
}): Promise<
  Omit<Proposal, 'proposalData'> & {
    proposalData: ProposalData;
    submittedBy: Profile & {
      avatarImage: ObjectsInStorage | null;
      isAnonymous: boolean;
    };
    processInstance: ProcessInstance;
    profile: Profile;
    commentsCount: number;
    likesCount: number;
    followersCount: number;
    proposalTemplate: ProposalTemplateSchema | null;
    documentContent: ProposalDocumentContent | undefined;
    htmlContent: Record<string, string> | undefined;
    attachments: ProposalAttachmentWithDetails[];
    isFlagged: boolean;
  }
> => {
  const proposal = await db.query.proposals.findFirst({
    // Moderation-detached (CSAM) proposals are treated as not-found even for
    // admins — same 404 the endpoint returns for a plain missing row.
    where: {
      RAW: (table) =>
        and(
          eq(table.profileId, profileId),
          isNull(table.moderationDetachedAt),
        )!,
    },
    with: {
      processInstance: true,
      submittedBy: {
        with: {
          avatarImage: true,
          profileUsers: {
            columns: {},
            with: { authUser: { columns: { isAnonymous: true } } },
          },
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
    throw new NotFoundError('Proposal', profileId);
  }

  // Reuse the resolved instance-profile roles (drive the instance-admin check
  // below) instead of re-fetching them per gate.
  const instanceRoles = await assertInstanceProfileAccess({
    user,
    instance: proposal.processInstance,
    profilePermissions: { decisions: permission.READ },
    orgFallbackPermissions: [
      { decisions: permission.READ },
      { decisions: permission.ADMIN },
    ],
  });

  // Draft, hidden, and flagged proposals are all restricted beyond plain
  // instance read access, and to the same axes of access (proposal-level
  // access and instance-admin). Resolve the caller's standing once and apply
  // the three gates together rather than re-checking per gate. NotFoundError
  // (never Unauthorized) throughout, so a restricted proposal's existence never
  // leaks. `isFlagged` also rides on the response so the owner/admin UI can
  // render the "Flagged" indicator.
  const isFlagged = await hasActiveModerationFlag('proposal', proposal.id);
  const isDraft = proposal.status === ProposalStatus.DRAFT;
  const isHidden = proposal.visibility === Visibility.HIDDEN;

  if (isDraft || isHidden || isFlagged) {
    // Proposal-level access = the creator + invited collaborators (a
    // profileUsers record on the proposal's own profile). Only fetched for a
    // restricted proposal — a plain visible proposal never needs it.
    const proposalRoles = await getProfileAccessRoles({
      user,
      profileId: proposal.profileId,
    });
    const hasProposalAccess = proposalRoles.length > 0;
    const isInstanceAdmin = checkPermission(
      { profile: permission.ADMIN },
      instanceRoles,
    );

    // Drafts are visible only to proposal-level access (not instance admins);
    // hidden and flagged proposals are visible to that audience OR instance
    // admins.
    const visibleToCaller = isDraft
      ? hasProposalAccess
      : hasProposalAccess || isInstanceAdmin;
    if (!visibleToCaller) {
      throw new NotFoundError('Proposal', profileId);
    }
  }

  // Read proposalTemplate from instanceData (new path) or processSchema (legacy path)
  const proposalTemplate = await resolveProposalTemplate(
    proposal.processInstance.instanceData as Record<string, unknown> | null,
    proposal.processInstance.processId,
  );
  const parsedProposalData = parseProposalData(proposal.proposalData);
  const collaborationDocVersionId =
    proposal.status === ProposalStatus.DRAFT
      ? undefined
      : parsedProposalData.collaborationDocVersionId;

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
      : Promise.resolve({
          commentsCount: 0,
          likesCount: 0,
          followersCount: 0,
        }),

    // Fetch document content. Mark a failed fetch as 'unavailable' rather
    // than throwing: the proposal (title, budget, attachments) still renders
    // while the client polls for the document and only shows a "content not
    // found" state after a bounded wait — a still-syncing doc shouldn't flash
    // an error.
    getProposalDocumentsContent(
      [
        {
          id: proposal.id,
          proposalData: proposal.proposalData,
          proposalTemplate,
          collaborationDocVersionId,
        },
      ],
      { onFetchError: 'unavailable' },
    ),
  ]);

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

  const { profileUsers, ...submittedByProfile } = proposal.submittedBy;

  return {
    ...proposal,
    submittedBy: {
      ...submittedByProfile,
      isAnonymous: Boolean(
        profileUsers?.some((pu) => pu.authUser?.isAnonymous),
      ),
    },
    proposalData: parsedProposalData,
    proposalTemplate,
    ...engagementCounts,
    documentContent,
    htmlContent,
    attachments: attachmentsWithUrls,
    isFlagged,
  };
};

export const getPermissionsOnProposal = async ({
  user,
  proposal,
}: {
  user: User | undefined;
  proposal: Proposal & { processInstance: ProcessInstance };
}): Promise<{ access: DecisionRolePermissions; isEditable: boolean }> => {
  const roles = await getProfileAccessRoles({
    user,
    profileId: proposal.profileId,
  });

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

  // The comment / post-write gate in `assertPostWriteAccess` walks proposal
  // targets up to the parent decision via `resolvePostRoots` and admits
  // `{ profile: ADMIN }` OR `{ decisions: SUBMIT_PROPOSALS }` on the decision
  // profile — bits that live on `profileUsers` for the *decision* profile,
  // not the proposal profile. Mirror that OR on `access.submitProposals` so
  // the frontend can mirror the server gate and hide the comment box only
  // for callers who'd be rejected on submit. Leave the other bits
  // (update / admin) on proposal-profile roles — editability and admin
  // signal are separate concerns from comment access.
  if (proposal.processInstance.profileId) {
    const decisionRoles = await getProfileAccessRoles({
      user,
      profileId: proposal.processInstance.profileId,
    });
    if (
      checkPermission(
        [
          { profile: permission.ADMIN },
          { decisions: decisionPermission.SUBMIT_PROPOSALS },
        ],
        decisionRoles,
      )
    ) {
      access.submitProposals = true;
    }
  }

  // `access.update` says the caller may write this proposal at all (the author
  // and their invited collaborators). Editing what they already submitted is
  // additionally governed by the phase's "Proposal editing" rule, so the Edit
  // affordance disappears with the setting. The revision-response flow reaches
  // the editor through its own "Revise" affordance, not this flag.
  const instancePhases =
    (proposal.processInstance.instanceData as DecisionInstanceData | null)
      ?.phases ?? [];
  const isEditable =
    access.update &&
    (proposal.status === ProposalStatus.DRAFT ||
      isPostSubmissionEditingAllowed({
        phases: instancePhases,
        currentPhaseId: proposal.processInstance.currentStateId,
      }));

  return { access, isEditable };
};
