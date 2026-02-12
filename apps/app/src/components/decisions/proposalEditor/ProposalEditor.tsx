'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import {
  type ProcessInstance,
  ProposalStatus,
  type proposalEncoder,
} from '@op/api/encoders';
import { type ProposalDataInput, parseProposalData } from '@op/common/client';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import {
  CollaborativeDocProvider,
  CollaborativePresence,
} from '../../collaboration';
import { ProposalAttachments } from '../ProposalAttachments';
import { ProposalEditorSkeleton } from '../ProposalEditorSkeleton';
import { ProposalInfoModal } from '../ProposalInfoModal';
import { ProposalEditorLayout } from '../layout';
import { ProposalFormRenderer } from './ProposalFormRenderer';
import {
  type ProposalTemplateSchema,
  compileProposalSchema,
} from './compileProposalSchema';
import { handleMutationError } from './handleMutationError';
import { useProposalDraft } from './useProposalDraft';

type Proposal = z.infer<typeof proposalEncoder>;

export function ProposalEditor({
  instance,
  backHref,
  proposal,
  isEditMode = false,
}: {
  instance: ProcessInstance;
  backHref: string;
  proposal: Proposal;
  isEditMode?: boolean;
}) {
  const { user } = useUser();
  const router = useRouter();
  const t = useTranslations();
  const posthog = usePostHog();
  const utils = trpc.useUtils();

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDraft = isEditMode && proposal?.status === ProposalStatus.DRAFT;

  // -- Instance config -------------------------------------------------------

  // TODO: Remove once categories are baked into the proposal schema
  const [categoriesData] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId: instance.id,
  });
  const categories = categoriesData.categories;

  const proposalInfoTitle = instance.instanceData?.fieldValues
    ?.proposalInfoTitle as string | undefined;
  const proposalInfoContent = instance.instanceData?.fieldValues
    ?.proposalInfoContent as string | undefined;

  // -- Collaboration ---------------------------------------------------------

  const collaborationDocId = useMemo(() => {
    const { collaborationDocId: existingId } = parseProposalData(
      proposal?.proposalData,
    );
    if (existingId) {
      return existingId;
    }
    return `proposal-${instance.id}-${proposal?.id ?? crypto.randomUUID()}`;
  }, [proposal?.proposalData, proposal?.id, instance.id]);

  // -- Draft management ------------------------------------------------------

  const { draft, draftRef, handleFieldChange } = useProposalDraft({
    proposal,
    isEditMode,
    collaborationDocId,
  });

  // -- Schema compilation ----------------------------------------------------

  // TODO: Wire up to the real template source. For now we hardcode a mock.
  // const rawProposalTemplate = (instance.process?.processSchema
  //   ?.proposalTemplate ?? null) as ProposalTemplateSchema | null;

  // System fields (title, category, budget) are duplicated to proposalData
  // for search, preview, and sorting. Yjs is the source of truth — the DB
  // copy is a derived snapshot. Dynamic template fields live exclusively
  // in Yjs and are NOT part of proposalData.
  const proposalTemplate: ProposalTemplateSchema = {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        title: t('Title'),
        minLength: 1,
        'x-format': 'short-text',
      },
      category: {
        type: ['string', 'null'],
        title: t('Category'),
        'x-format': 'category',
        ...(categories.length > 0 && {
          oneOf: categories.map((c) => ({
            const: c.name,
            title: c.name,
          })),
        }),
      },
      budget: {
        type: ['number', 'null'],
        title: t('Budget'),
        minimum: 0,
        'x-format': 'money',
      },
      summary: {
        type: 'string',
        title: t('Summary'),
        'x-format': 'long-text',
      },
    },
    required: ['title'],
  };

  const templateRef = useRef(proposalTemplate);
  templateRef.current = proposalTemplate;

  const proposalFields = compileProposalSchema(proposalTemplate);

  // -- Mutations -------------------------------------------------------------

  const submitProposalMutation = trpc.decision.submitProposal.useMutation({
    onSuccess: async () => {
      posthog?.capture('submit_proposal_success', {
        process_instance_id: instance.id,
        process_name: instance.name || instance.instanceData?.templateName,
      });
      await utils.decision.listProposals.invalidate({
        processInstanceId: instance.id,
      });
      router.push(backHref);
    },
    onError: (error) => handleMutationError(error, 'submit', t),
  });

  const updateProposalMutation = trpc.decision.updateProposal.useMutation({
    onSuccess: async () => {
      await utils.decision.getProposal.invalidate({
        profileId: proposal?.profileId,
      });
      await utils.decision.listProposals.invalidate({
        processInstanceId: instance.id,
      });
      router.push(backHref);
    },
    onError: (error) => handleMutationError(error, 'update', t),
  });

  // -- UI state handlers -----------------------------------------------------

  const handleCloseInfoModal = () => setShowInfoModal(false);

  // Show info modal on mount for new/draft proposals
  useEffect(() => {
    if ((!isEditMode || isDraft) && proposalInfoTitle && proposalInfoContent) {
      setShowInfoModal(true);
    }
  }, [isEditMode, isDraft, proposalInfoTitle, proposalInfoContent]);

  const handleSubmitProposal = useCallback(async () => {
    const currentDraft = draftRef.current;
    const template = templateRef.current;
    const templateRequired = Array.isArray(template.required)
      ? template.required
      : [];

    const missingFields: string[] = [];

    if (!currentDraft.title || currentDraft.title.trim() === '') {
      missingFields.push(t('Title'));
    }

    if (templateRequired.includes('budget') && currentDraft.budget === null) {
      missingFields.push(t('Budget'));
    }

    const categorySchema = template.properties?.category;
    const hasCategories =
      typeof categorySchema === 'object' &&
      Array.isArray(categorySchema?.oneOf) &&
      categorySchema.oneOf.length > 0;

    if (
      templateRequired.includes('category') &&
      hasCategories &&
      currentDraft.category === null
    ) {
      missingFields.push(t('Category'));
    }

    const budgetSchema = template.properties?.budget;
    const budgetMax =
      typeof budgetSchema === 'object' &&
      typeof budgetSchema?.maximum === 'number'
        ? budgetSchema.maximum
        : undefined;

    if (
      currentDraft.budget !== null &&
      budgetMax !== undefined &&
      currentDraft.budget > budgetMax
    ) {
      toast.error({
        message: t('Budget cannot exceed {amount}', {
          amount: budgetMax.toLocaleString(),
        }),
      });
      return;
    }

    if (missingFields.length > 0) {
      toast.error({
        title: t('Please complete the following required fields:'),
        message: missingFields.join(', '),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (!proposal) {
        throw new Error('No proposal to update');
      }

      const proposalData: ProposalDataInput = {
        ...parseProposalData(proposal.proposalData),
        collaborationDocId,
        title: currentDraft.title,
        category: hasCategories
          ? (currentDraft.category ?? undefined)
          : undefined,
        budget: currentDraft.budget ?? undefined,
      };

      await updateProposalMutation.mutateAsync({
        proposalId: proposal.id,
        data: {
          proposalData,
        },
      });

      if (isDraft) {
        await submitProposalMutation.mutateAsync({
          proposalId: proposal.id,
        });
      }
    } catch (error) {
      console.error('Failed to update proposal:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    t,
    collaborationDocId,
    proposal,
    isDraft,
    submitProposalMutation,
    updateProposalMutation,
    draftRef,
  ]);

  // -- Render ----------------------------------------------------------------

  const userName = user.profile?.name ?? t('Anonymous');

  return (
    <CollaborativeDocProvider
      docId={collaborationDocId}
      userName={userName}
      fallback={<ProposalEditorSkeleton />}
    >
      <ProposalEditorLayout
        backHref={backHref}
        title={draft.title}
        onSubmitProposal={handleSubmitProposal}
        isSubmitting={isSubmitting}
        isEditMode={isEditMode}
        isDraft={isDraft}
        presenceSlot={<CollaborativePresence />}
      >
        <div className="flex flex-1 flex-col gap-12 pt-12">
          {/* TODO: Re-add RichTextEditorToolbar that tracks the currently-focused
              editor instance so it works with multiple CollaborativeTextField fields. */}
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6">
            <ProposalFormRenderer
              fields={proposalFields}
              draft={draft}
              onFieldChange={handleFieldChange}
              t={t}
            />

            <div className="border-t border-neutral-gray2 pt-8">
              <ProposalAttachments
                proposalId={proposal.id}
                attachments={
                  proposal.attachments?.map((pa) => ({
                    id: pa.attachmentId,
                    fileName: pa.attachment?.fileName ?? t('Unknown'),
                    fileSize: pa.attachment?.fileSize ?? null,
                    url: pa.attachment?.url,
                  })) ?? []
                }
                onMutate={() =>
                  utils.decision.getProposal.invalidate({
                    profileId: proposal.profileId,
                  })
                }
              />
            </div>
          </div>
        </div>

        {proposalInfoTitle && proposalInfoContent && (
          <ProposalInfoModal
            isOpen={showInfoModal}
            onClose={handleCloseInfoModal}
            title={proposalInfoTitle}
            content={proposalInfoContent}
          />
        )}
      </ProposalEditorLayout>
    </CollaborativeDocProvider>
  );
}
