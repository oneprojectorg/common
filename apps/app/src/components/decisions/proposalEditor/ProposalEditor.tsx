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
import type { Editor } from '@tiptap/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { RichTextEditorToolbar } from '../../RichTextEditor';
import {
  CollaborativeDocProvider,
  CollaborativePresence,
} from '../../collaboration';
import { ProposalAttachments } from '../ProposalAttachments';
import { ProposalEditorLayout } from '../ProposalEditorLayout';
import { ProposalEditorSkeleton } from '../ProposalEditorSkeleton';
import { ProposalInfoModal } from '../ProposalInfoModal';
import { schemaHasOptions } from '../proposalTemplate';
import { ProposalFormRenderer } from './ProposalFormRenderer';
import {
  type ProposalTemplateSchema,
  compileProposalSchema,
} from './compileProposalSchema';
import { handleMutationError } from './handleMutationError';
import { useProposalDraft } from './useProposalDraft';

type Proposal = z.infer<typeof proposalEncoder>;

/**
 * Tracks which TipTap editor currently has focus.
 *
 * Handles the blur/focus race condition: when clicking from editor A to
 * editor B, `blur` fires before `focus`. We defer the blur-to-null via
 * `requestAnimationFrame` and cancel it when a focus fires first.
 */
function useFocusedEditor() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const pendingBlur = useRef<number | null>(null);

  const onEditorFocus = useCallback((e: Editor) => {
    if (pendingBlur.current !== null) {
      cancelAnimationFrame(pendingBlur.current);
      pendingBlur.current = null;
    }
    setEditor(e);
  }, []);

  const onEditorBlur = useCallback((e: Editor) => {
    pendingBlur.current = requestAnimationFrame(() => {
      pendingBlur.current = null;
      setEditor((cur) => (cur === e ? null : cur));
    });
  }, []);

  useEffect(() => {
    return () => {
      if (pendingBlur.current !== null) {
        cancelAnimationFrame(pendingBlur.current);
      }
    };
  }, []);

  return { editor, onEditorFocus, onEditorBlur };
}

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
  const utils = trpc.useUtils();

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDraft = isEditMode && proposal?.status === ProposalStatus.DRAFT;

  // -- Instance config -------------------------------------------------------

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

  const proposalTemplate = instance.instanceData
    ?.proposalTemplate as ProposalTemplateSchema | null;

  if (!proposalTemplate) {
    throw new Error('Proposal template not found on instance');
  }

  const templateRef = useRef(proposalTemplate);
  templateRef.current = proposalTemplate;

  const proposalFields = compileProposalSchema(proposalTemplate);

  // -- Mutations -------------------------------------------------------------

  const submitProposalMutation = trpc.decision.submitProposal.useMutation({
    onError: (error) => handleMutationError(error, 'submit', t),
  });

  const updateProposalMutation = trpc.decision.updateProposal.useMutation({
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

    if (templateRequired.includes('budget') && !currentDraft.budget) {
      missingFields.push(t('Budget'));
    }

    const categorySchema = template.properties?.category;
    const hasCategories =
      typeof categorySchema === 'object' && schemaHasOptions(categorySchema);

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
      currentDraft.budget.amount > budgetMax
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

      await Promise.all([
        utils.decision.getProposal.invalidate({
          profileId: proposal.profileId,
        }),
        utils.decision.listProposals.invalidate({
          processInstanceId: instance.id,
        }),
      ]);
      router.push(backHref);
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

  const {
    editor: focusedEditor,
    onEditorFocus,
    onEditorBlur,
  } = useFocusedEditor();

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
        proposalProfileId={proposal.profileId}
      >
        <div
          className="sticky top-0 z-10 bg-white"
          onMouseDown={(e) => e.preventDefault()}
        >
          <RichTextEditorToolbar editor={focusedEditor} />
        </div>
        <div className="flex flex-1 flex-col gap-12 pt-12">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6">
            <ProposalFormRenderer
              fields={proposalFields}
              draft={draft}
              onFieldChange={handleFieldChange}
              onEditorFocus={onEditorFocus}
              onEditorBlur={onEditorBlur}
            />

            <div className="border-t border-neutral-gray1 pt-8">
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
