import { type RubricTemplateSchema, createDecisionRole } from '@op/common';
import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  attachments,
  objectsInStorage,
  processInstances,
  proposalAttachments,
} from '@op/db/schema';
import {
  configureProcessReviews,
  createInstanceMember as coreCreateInstanceMember,
  createReviewScenario,
  defaultReviewSettings,
} from '@op/test';
import { eq } from 'drizzle-orm';

import { supabaseTestAdminClient } from '../supabase-utils';
import { TestDecisionsDataManager } from './TestDecisionsDataManager';

interface ReviewParticipant {
  authUserId: string;
  email: string;
  profileId: string;
}

interface ReviewAssignmentContext {
  organization: { id: string; profileId: string };
  process: { id: string };
  instance: {
    instance: {
      id: string;
    };
    profileId: string;
  };
  defaultReviewer: ReviewParticipant;
}

interface CreateReviewAssignmentOptions {
  context?: ReviewAssignmentContext;
  reviewer?: ReviewParticipant;
  author?: ReviewParticipant;
  title?: string;
  description?: string;
  status?: ProposalReviewAssignmentStatus;
}

/** Creates review-focused test fixtures on top of the decision test setup. */
export class TestReviewsDataManager {
  private testId: string;
  private decisions: TestDecisionsDataManager;

  constructor(
    testId: string,
    onTestFinished: (fn: () => void | Promise<void>) => void,
  ) {
    this.testId = testId;
    this.decisions = new TestDecisionsDataManager(testId, onTestFinished);
  }

  /** Creates a configured review context for review API tests. */
  async createContext(): Promise<ReviewAssignmentContext> {
    const setup = await this.decisions.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];

    if (!instance) {
      throw new Error('No instance created');
    }

    const reviewerUser = await db.query.users.findFirst({
      where: {
        authUserId: setup.user.id,
      },
      columns: {
        profileId: true,
      },
    });

    if (!reviewerUser?.profileId) {
      throw new Error(`No user profile found for auth user ${setup.user.id}`);
    }

    await configureProcessReviews({
      processId: setup.process.id,
      settings: defaultReviewSettings,
    });

    return {
      organization: setup.organization,
      process: setup.process,
      instance,
      defaultReviewer: {
        authUserId: setup.user.id,
        email: setup.userEmail,
        profileId: reviewerUser.profileId,
      },
    };
  }

  /** Creates a reviewer with access to the review context instance. */
  async createReviewer(context: ReviewAssignmentContext) {
    const reviewer = await this.decisions.createMemberUser({
      organization: context.organization,
    });

    await this.decisions.grantProfileAccess(
      context.instance.profileId,
      reviewer.authUserId,
      reviewer.email,
      true,
    );

    return {
      authUserId: reviewer.authUserId,
      email: reviewer.email,
      profileId: reviewer.profileId,
    };
  }

  /**
   * Creates a member user granted a custom "Reviewer" role on the instance —
   * READ + REVIEW on the decisions zone, no ADMIN. Mirrors a production
   * reviewer who has the REVIEW capability but isn't a profile admin.
   */
  async createInstanceReviewerWithRole(context: ReviewAssignmentContext) {
    const reviewerRole = await createDecisionRole({
      name: `Reviewer-${this.testId}`,
      profileId: context.instance.profileId,
      permissions: {
        decisions: {
          type: 'decision',
          value: {
            create: false,
            read: true,
            update: false,
            delete: false,
            admin: false,
            inviteMembers: false,
            review: true,
            submitProposals: false,
            vote: false,
          },
        },
      },
    });

    const reviewer = await this.decisions.createMemberUser({
      organization: context.organization,
      instanceProfileIds: [context.instance.profileId],
      roleIds: { [context.instance.profileId]: reviewerRole.id },
    });

    return {
      authUserId: reviewer.authUserId,
      email: reviewer.email,
      profileId: reviewer.profileId,
    };
  }

  /**
   * Creates a participant with Member-only access on the instance profile —
   * i.e. READ on decisions, but no REVIEW and no ADMIN. Useful to assert
   * that non-reviewer, non-admin callers cannot see reviewer-scoped data.
   */
  async createInstanceMember(context: ReviewAssignmentContext) {
    if (!supabaseTestAdminClient) {
      throw new Error('Supabase admin test client not initialized');
    }

    const { user } = await coreCreateInstanceMember({
      supabaseAdmin: supabaseTestAdminClient,
      testId: this.testId,
      organization: { id: context.organization.id },
      instanceProfileId: context.instance.profileId,
    });

    this.decisions.trackAuthUserForCleanup(user.authUserId);
    this.decisions.trackProfileForCleanup(user.profileId);

    return {
      authUserId: user.authUserId,
      email: user.email,
      profileId: user.profileId,
    };
  }

  /**
   * Advances a process instance to the given phase by stamping `currentStateId`
   * directly. Used by review API tests because review assignments are tagged
   * with a `phaseId` (production default `'review'`), so the instance has to
   * be on that phase for phase-scoped queries to return them.
   */
  async setCurrentPhase(instanceId: string, phaseId: string) {
    await db
      .update(processInstances)
      .set({ currentStateId: phaseId })
      .where(eq(processInstances.id, instanceId));
  }

  /** Sets the rubric template on a process instance for review API tests. */
  async setRubricTemplate(
    context: ReviewAssignmentContext,
    rubricTemplate: RubricTemplateSchema,
  ) {
    const instanceRecord = await db.query.processInstances.findFirst({
      where: {
        id: context.instance.instance.id,
      },
    });

    if (!instanceRecord) {
      throw new Error(
        `Process instance not found: ${context.instance.instance.id}`,
      );
    }

    const instanceData =
      instanceRecord.instanceData &&
      typeof instanceRecord.instanceData === 'object'
        ? instanceRecord.instanceData
        : {};

    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...instanceData,
          rubricTemplate,
        },
      })
      .where(eq(processInstances.id, context.instance.instance.id));
  }

  /** Creates a single review assignment and the minimum related data it needs. */
  async createReviewAssignment(opts: CreateReviewAssignmentOptions = {}) {
    const context = opts.context ?? (await this.createContext());
    const reviewer = opts.reviewer ?? context.defaultReviewer;

    const resolvedAuthor =
      opts.author ??
      (await this.decisions.createMemberUser({
        organization: context.organization,
        instanceProfileIds: [context.instance.profileId],
      }));

    const { proposal, assignment } = await createReviewScenario({
      instance: { id: context.instance.instance.id },
      author: resolvedAuthor,
      reviewer: { profileId: reviewer.profileId },
      proposalData: {
        title: opts.title ?? 'Community Garden Expansion',
        ...(opts.description ? { description: opts.description } : {}),
      },
      assignmentStatus: opts.status,
    });

    this.decisions.trackProfileForCleanup(proposal.profileId);

    return {
      context,
      assignment: {
        id: assignment.id,
        status: assignment.status,
      },
      author: resolvedAuthor,
      proposal,
      reviewer,
      instance: context.instance,
    };
  }

  /** Attaches a file to an existing proposal for review payload tests. */
  async attachFileToProposal({
    proposalId,
    uploadedByProfileId,
    fileName,
  }: {
    proposalId: string;
    uploadedByProfileId: string;
    fileName: string;
  }) {
    const [storageObject] = await db
      .insert(objectsInStorage)
      .values({
        bucketId: 'assets',
        name: `review-test/${proposalId}/${fileName}`,
      })
      .returning();

    if (!storageObject) {
      throw new Error(
        'Failed to create storage object for proposal attachment',
      );
    }

    const [attachment] = await db
      .insert(attachments)
      .values({
        storageObjectId: storageObject.id,
        fileName,
        mimeType: 'application/pdf',
        fileSize: 1024,
        profileId: uploadedByProfileId,
      })
      .returning();

    if (!attachment) {
      throw new Error('Failed to create attachment for proposal');
    }

    await db.insert(proposalAttachments).values({
      proposalId,
      attachmentId: attachment.id,
      uploadedBy: uploadedByProfileId,
    });

    return attachment;
  }
}
