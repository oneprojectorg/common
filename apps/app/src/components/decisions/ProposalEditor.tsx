'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import {
  type ProcessInstance,
  ProposalStatus,
  type proposalEncoder,
} from '@op/api/encoders';
import { type ProposalDataInput, parseProposalData } from '@op/common/client';
import { useDebouncedCallback } from '@op/hooks';
import { toast } from '@op/ui/Toast';
import type { Editor } from '@tiptap/react';
import { useRouter } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import {
  RichTextEditorToolbar,
  getProposalExtensions,
} from '../RichTextEditor';
import {
  CollaborativeBudgetField,
  CollaborativeCategoryField,
  CollaborativeDocProvider,
  CollaborativeEditor,
  CollaborativePresence,
  CollaborativeTitleField,
} from '../collaboration';
import { ProposalAttachments } from './ProposalAttachments';
import { ProposalEditorSkeleton } from './ProposalEditorSkeleton';
import { ProposalInfoModal } from './ProposalInfoModal';
import { ProposalEditorLayout } from './layout';

type Proposal = z.infer<typeof proposalEncoder>;

/** Handles tRPC validation errors from mutation responses */
function handleMutationError(
  error: { data?: unknown; message?: string },
  operationType: 'create' | 'update' | 'submit',
) {
  console.error(`Failed to ${operationType} proposal:`, error);

  const errorData = error.data as
    | { cause?: { fieldErrors?: Record<string, string> } }
    | undefined;

  if (errorData?.cause?.fieldErrors) {
    const fieldErrors = errorData.cause.fieldErrors;
    const errorMessages = Object.values(fieldErrors);

    if (errorMessages.length === 1) {
      toast.error({ message: errorMessages[0] });
    } else {
      toast.error({
        title: 'Please fix the following issues:',
        message: errorMessages.join(', '),
      });
    }
  } else {
    toast.error({
      title: `Failed to ${operationType} proposal`,
      message: error.message || 'An unexpected error occurred',
    });
  }
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
  const router = useRouter();
  const t = useTranslations();
  const posthog = usePostHog();
  const utils = trpc.useUtils();
  const { user } = useUser();

  const [title, setTitle] = useState('');
  const titleRef = useRef('');
  const categoryRef = useRef<string | null>(null);
  const budgetRef = useRef<number | null>(null);

  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initializedRef = useRef(false);

  // Check if editing a draft (should show info modal and use submitProposal)
  const isDraft = isEditMode && proposal?.status === ProposalStatus.DRAFT;

  const collaborationDocId = useMemo(() => {
    const { collaborationDocId: existingId } = parseProposalData(
      proposal?.proposalData,
    );
    if (existingId) {
      return existingId;
    }
    return `proposal-${instance.id}-${proposal?.id ?? crypto.randomUUID()}`;
  }, [proposal?.proposalData, proposal?.id, instance.id]);

  // Editor extensions - memoized with collaborative flag
  const editorExtensions = useMemo(
    () => getProposalExtensions({ collaborative: true }),
    [],
  );

  // Extract template data from the instance
  const proposalInfoTitle = instance.instanceData?.fieldValues
    ?.proposalInfoTitle as string | undefined;
  const proposalInfoContent = instance.instanceData?.fieldValues
    ?.proposalInfoContent as string | undefined;

  // Get categories from database
  const [categoriesData] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId: instance.id,
  });
  const { categories } = categoriesData;

  // Extract budget config from current phase settings or legacy template
  const { budgetCapAmount, isBudgetRequired } = useMemo(() => {
    let cap: number | undefined;
    let required = true; // Default to required

    // New schema: get budget from current phase settings
    const currentPhaseId = instance.instanceData?.currentPhaseId;
    const currentPhaseData = instance.instanceData?.phases?.find(
      (p) => p.phaseId === currentPhaseId,
    );
    const phaseBudget = currentPhaseData?.settings?.budget as
      | number
      | undefined;

    if (phaseBudget != null) {
      return { budgetCapAmount: phaseBudget, isBudgetRequired: required };
    }

    // Fallback to instance data fieldValues
    if (!cap && instance.instanceData?.fieldValues?.budgetCapAmount) {
      cap = instance.instanceData.fieldValues.budgetCapAmount as number;
    }

    return { budgetCapAmount: cap, isBudgetRequired: required };
  }, [instance]);

  const parsedProposalData = useMemo(
    () =>
      isEditMode && proposal ? parseProposalData(proposal.proposalData) : null,
    [isEditMode, proposal],
  );

  // Mutations
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
    onError: (error) => handleMutationError(error, 'submit'),
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
    onError: (error) => handleMutationError(error, 'update'),
  });

  const autoSaveMutation = trpc.decision.updateProposal.useMutation({
    onError: (error) => {
      console.error('Auto-save failed:', error);
    },
  });

  const debouncedAutoSave = useDebouncedCallback(() => {
    if (!proposal) {
      return;
    }

    const currentData = parseProposalData(proposal.proposalData);

    autoSaveMutation.mutate({
      proposalId: proposal.id,
      data: {
        proposalData: {
          ...currentData,
          collaborationDocId,
          title: titleRef.current,
          category: categoryRef.current ?? undefined,
          budget: budgetRef.current ?? undefined,
        },
      },
    });
  }, 1500);

  // Initialize title from existing proposal data
  useEffect(() => {
    if (
      isEditMode &&
      proposal &&
      parsedProposalData &&
      !initializedRef.current
    ) {
      if (parsedProposalData.title) {
        titleRef.current = parsedProposalData.title;
        setTitle(parsedProposalData.title);
      }
      initializedRef.current = true;
    }
  }, [isEditMode, proposal, parsedProposalData]);

  // Show info modal for new proposals or drafts
  useEffect(() => {
    if ((!isEditMode || isDraft) && proposalInfoTitle && proposalInfoContent) {
      setShowInfoModal(true);
    }
  }, [isEditMode, isDraft, proposalInfoTitle, proposalInfoContent]);

  const handleEditorReady = useCallback((editor: Editor) => {
    setEditorInstance(editor);
  }, []);

  const handleCloseInfoModal = useCallback(() => {
    setShowInfoModal(false);
  }, []);

  const handleCategoryChange = useCallback(
    (category: string | null) => {
      categoryRef.current = category;
      debouncedAutoSave();
    },
    [debouncedAutoSave],
  );

  const handleBudgetChange = useCallback(
    (budget: number | null) => {
      budgetRef.current = budget;
      debouncedAutoSave();
    },
    [debouncedAutoSave],
  );

  const handleSubmitProposal = useCallback(async () => {
    const currentTitle = titleRef.current;
    const currentBudget = budgetRef.current;
    const currentCategory = categoryRef.current;

    // Validate required fields
    const missingFields: string[] = [];

    if (!currentTitle || currentTitle.trim() === '') {
      missingFields.push(t('Title'));
    }

    // Check for empty content in the editor
    if (editorInstance) {
      if (editorInstance.isEmpty) {
        missingFields.push(t('Description'));
      }
    }

    if (isBudgetRequired && currentBudget === null) {
      missingFields.push(t('Budget'));
    }

    // Validate budget cap
    if (
      currentBudget !== null &&
      budgetCapAmount &&
      currentBudget > budgetCapAmount
    ) {
      toast.error({
        message: t('Budget cannot exceed {amount}', {
          amount: budgetCapAmount.toLocaleString(),
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
        title: currentTitle,
        category:
          categories && categories.length > 0
            ? (currentCategory ?? undefined)
            : undefined,
        budget: currentBudget ?? undefined,
      };

      // Update existing proposal
      await updateProposalMutation.mutateAsync({
        proposalId: proposal.id,
        data: {
          proposalData,
        },
      });

      // If draft, also submit (transition to submitted status)
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
    editorInstance,
    isBudgetRequired,
    budgetCapAmount,
    collaborationDocId,
    categories,
    proposal,
    isDraft,
    submitProposalMutation,
    updateProposalMutation,
  ]);

  const userName = user.profile?.name ?? 'Anonymous';

  const editorSkeleton = <ProposalEditorSkeleton />;

  return (
    <CollaborativeDocProvider
      docId={collaborationDocId}
      userName={userName}
      fallback={editorSkeleton}
    >
      <ProposalEditorLayout
        backHref={backHref}
        title={title}
        onSubmitProposal={handleSubmitProposal}
        isSubmitting={isSubmitting}
        isEditMode={isEditMode}
        isDraft={isDraft}
        presenceSlot={<CollaborativePresence />}
      >
        <div className="flex flex-1 flex-col gap-12">
          {editorInstance && <RichTextEditorToolbar editor={editorInstance} />}

          <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 sm:px-0">
            <CollaborativeTitleField
              placeholder="Untitled Proposal"
              onChange={(text) => {
                titleRef.current = text;
                setTitle(text);
                debouncedAutoSave();
              }}
            />

            <div className="flex gap-6">
              <CollaborativeCategoryField
                categories={categories ?? []}
                initialValue={parsedProposalData?.category ?? null}
                onChange={handleCategoryChange}
              />

              <CollaborativeBudgetField
                budgetCapAmount={budgetCapAmount}
                initialValue={parsedProposalData?.budget ?? null}
                onChange={handleBudgetChange}
              />
            </div>

            <CollaborativeEditor
              field="content"
              extensions={editorExtensions}
              onEditorReady={handleEditorReady}
              placeholder={t('Write your proposal here...')}
              editorClassName="w-full !max-w-[32rem] sm:min-w-[32rem] min-h-[20rem] px-0 py-4"
            />

            <div className="border-t border-neutral-gray2 pt-8">
              <ProposalAttachments
                proposalId={proposal.id}
                attachments={
                  proposal.attachments?.map((pa) => ({
                    id: pa.attachmentId,
                    fileName: pa.attachment?.fileName ?? 'Unknown',
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
