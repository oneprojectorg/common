'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import {
  type ProcessInstance,
  ProposalStatus,
  type proposalEncoder,
} from '@op/api/encoders';
import { type ProposalDataInput, parseProposalData } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { NumberField } from '@op/ui/NumberField';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import type { TiptapCollabProvider } from '@tiptap-pro/provider';
import type { Editor } from '@tiptap/react';
import { useRouter } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import {
  CollaborativeEditor,
  CollaborativePresence,
  RichTextEditorToolbar,
  getProposalExtensions,
} from '../RichTextEditor';
import { ProposalAttachments } from './ProposalAttachments';
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
  existingProposal,
  isEditMode = false,
}: {
  instance: ProcessInstance;
  backHref: string;
  existingProposal?: Proposal;
  isEditMode?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations();
  const posthog = usePostHog();
  const utils = trpc.useUtils();
  const { user } = useUser();

  // Form state
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [showBudgetInput, setShowBudgetInput] = useState(false);

  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [collabProvider, setCollabProvider] =
    useState<TiptapCollabProvider | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs
  const budgetInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  // Check if editing a draft (should show info modal and use submitProposal)
  const isDraft =
    isEditMode && existingProposal?.status === ProposalStatus.DRAFT;

  const collaborationDocId = useMemo(() => {
    const { collaborationDocId: existingId } = parseProposalData(
      existingProposal?.proposalData,
    );
    if (existingId) {
      return existingId;
    }
    return `proposal-${instance.id}-${existingProposal?.id ?? crypto.randomUUID()}`;
  }, [existingProposal?.proposalData, existingProposal?.id, instance.id]);

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

    // Legacy schema: extract from proposalTemplate.properties.budget
    const proposalTemplate = instance.process?.processSchema?.proposalTemplate;
    if (
      proposalTemplate &&
      typeof proposalTemplate === 'object' &&
      'properties' in proposalTemplate
    ) {
      const properties = proposalTemplate.properties;
      if (
        properties &&
        typeof properties === 'object' &&
        'budget' in properties
      ) {
        const budgetProp = properties.budget;
        if (
          budgetProp &&
          typeof budgetProp === 'object' &&
          'maximum' in budgetProp
        ) {
          cap = budgetProp.maximum as number;
        }
      }

      // Check if budget is in required array
      if (
        'required' in proposalTemplate &&
        Array.isArray(proposalTemplate.required)
      ) {
        required = proposalTemplate.required.includes('budget');
      }
    }

    // Fallback to instance data fieldValues
    if (!cap && instance.instanceData?.fieldValues?.budgetCapAmount) {
      cap = instance.instanceData.fieldValues.budgetCapAmount as number;
    }

    return { budgetCapAmount: cap, isBudgetRequired: required };
  }, [instance]);

  // Parse existing proposal data for editing
  const parsedProposalData = useMemo(
    () =>
      isEditMode && existingProposal
        ? parseProposalData(existingProposal.proposalData)
        : null,
    [isEditMode, existingProposal],
  );

  // Mutations
  const submitProposalMutation = trpc.decision.submitProposal.useMutation({
    onSuccess: async () => {
      posthog?.capture('submit_proposal_success', {
        process_instance_id: instance.id,
        process_name: instance.process?.name,
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
        profileId: existingProposal?.profileId,
      });
      await utils.decision.listProposals.invalidate({
        processInstanceId: instance.id,
      });
      router.push(backHref);
    },
    onError: (error) => handleMutationError(error, 'update'),
  });

  // Initialize form with existing proposal data
  useEffect(() => {
    if (
      isEditMode &&
      existingProposal &&
      parsedProposalData &&
      !initializedRef.current
    ) {
      const {
        title: existingTitle,
        category: existingCategory,
        budget: existingBudget,
      } = parsedProposalData;

      if (existingTitle) {
        setTitle(existingTitle);
      }
      if (existingCategory) {
        setSelectedCategory(existingCategory);
      }
      if (existingBudget !== undefined) {
        setBudget(existingBudget);
        setShowBudgetInput(true);
      }

      initializedRef.current = true;
    }
  }, [isEditMode, existingProposal, parsedProposalData]);

  // Show info modal for new proposals or drafts
  useEffect(() => {
    if ((!isEditMode || isDraft) && proposalInfoTitle && proposalInfoContent) {
      setShowInfoModal(true);
    }
  }, [isEditMode, isDraft, proposalInfoTitle, proposalInfoContent]);

  // Auto-focus budget input when shown
  useEffect(() => {
    if (showBudgetInput && budgetInputRef.current) {
      budgetInputRef.current.focus();
    }
  }, [showBudgetInput]);

  const handleEditorReady = useCallback((editor: Editor) => {
    setEditorInstance(editor);
  }, []);

  const handleCloseInfoModal = useCallback(() => {
    setShowInfoModal(false);
  }, []);

  const handleSubmitProposal = useCallback(async () => {
    // Validate required fields
    const missingFields: string[] = [];

    if (!title || title.trim() === '') {
      missingFields.push(t('Title'));
    }

    // Check for empty content in the editor
    if (editorInstance) {
      const isEmpty = editorInstance.isEmpty;
      if (isEmpty) {
        missingFields.push(t('Description'));
      }
    }

    if (isBudgetRequired && budget === null) {
      missingFields.push(t('Budget'));
    }

    // Validate budget cap
    if (budget !== null && budgetCapAmount && budget > budgetCapAmount) {
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
      if (!existingProposal) {
        throw new Error('No proposal to update');
      }

      const proposalData: ProposalDataInput = {
        ...parseProposalData(existingProposal.proposalData),
        collaborationDocId,
        title,
        category:
          categories && categories.length > 0
            ? (selectedCategory ?? undefined)
            : undefined,
        budget: budget ?? undefined,
      };

      // Update existing proposal (attachments are saved on drop, not here)
      await updateProposalMutation.mutateAsync({
        proposalId: existingProposal.id,
        data: {
          proposalData,
        },
      });

      // If draft, also submit (transition to submitted status)
      if (isDraft) {
        await submitProposalMutation.mutateAsync({
          proposalId: existingProposal.id,
        });
      }
    } catch (error) {
      console.error('Failed to update proposal:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    t,
    title,
    editorInstance,
    isBudgetRequired,
    budget,
    budgetCapAmount,
    selectedCategory,
    collaborationDocId,
    categories,
    existingProposal,
    isDraft,
    submitProposalMutation,
    updateProposalMutation,
  ]);

  return (
    <ProposalEditorLayout
      backHref={backHref}
      title={title}
      onSubmitProposal={handleSubmitProposal}
      isSubmitting={isSubmitting}
      isEditMode={isEditMode}
      isDraft={isDraft}
      presenceSlot={<CollaborativePresence provider={collabProvider} />}
    >
      <div className="flex flex-1 flex-col gap-12">
        {editorInstance && <RichTextEditorToolbar editor={editorInstance} />}

        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {/* Title */}
          <TextField
            type="text"
            value={title}
            onChange={setTitle}
            inputProps={{
              placeholder: 'Untitled Proposal',
              className: 'border-0 p-0 font-serif !text-title-lg',
            }}
          />

          {/* Category and Budget */}
          <div className="flex gap-6">
            {categories && categories.length > 0 && (
              <Select
                variant="pill"
                size="medium"
                placeholder={t('Select category')}
                selectedKey={selectedCategory}
                onSelectionChange={(key) => setSelectedCategory(key as string)}
                className="w-auto max-w-36 overflow-hidden sm:max-w-96"
                popoverProps={{ className: 'sm:min-w-fit sm:max-w-2xl' }}
              >
                {categories.map((category) => (
                  <SelectItem
                    className="min-w-fit"
                    key={category.id}
                    id={category.name}
                  >
                    {category.name}
                  </SelectItem>
                ))}
              </Select>
            )}

            {!showBudgetInput && (
              <Button
                variant="pill"
                color="pill"
                onPress={() => setShowBudgetInput(true)}
              >
                Add budget
              </Button>
            )}

            {showBudgetInput && (
              <NumberField
                ref={budgetInputRef}
                value={budget}
                onChange={setBudget}
                prefixText="$"
                inputProps={{
                  placeholder: budgetCapAmount
                    ? `Max ${budgetCapAmount.toLocaleString()}`
                    : 'Enter amount',
                }}
                fieldClassName="w-auto"
              />
            )}
          </div>

          {/* Rich Text Editor with Collaboration */}
          <CollaborativeEditor
            docId={collaborationDocId}
            extensions={editorExtensions}
            onEditorReady={handleEditorReady}
            onProviderReady={setCollabProvider}
            placeholder={t('Write your proposal here...')}
            editorClassName="w-full !max-w-[32rem] sm:min-w-[32rem] min-h-[40rem] px-0 py-4"
            userName={user.profile?.name}
          />

          {/* Attachments */}
          {existingProposal && (
            <div className="border-t border-neutral-gray2 pt-8">
              <ProposalAttachments proposalId={existingProposal.id} />
            </div>
          )}
        </div>
      </div>

      {/* Proposal Info Modal */}
      {proposalInfoTitle && proposalInfoContent && (
        <ProposalInfoModal
          isOpen={showInfoModal}
          onClose={handleCloseInfoModal}
          title={proposalInfoTitle}
          content={proposalInfoContent}
        />
      )}
    </ProposalEditorLayout>
  );
}
