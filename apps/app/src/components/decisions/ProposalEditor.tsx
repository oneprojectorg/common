'use client';

import { ProcessInstance } from '@/utils/decisionProcessTransforms';
import {
  type ImageAttachment,
  extractAttachmentIdsFromUrls,
  extractImageUrlsFromContent,
} from '@/utils/proposalContentProcessor';
import { parseProposalData } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import { ProposalStatus, type proposalEncoder } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { NumberField } from '@op/ui/NumberField';
import { RichTextEditor, type RichTextEditorRef } from '@op/ui/RichTextEditor';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { RichTextEditorToolbar } from '../RichTextEditor';
import { getEditorExtensions } from '../RichTextEditor/editorConfig';
import { ProposalInfoModal } from './ProposalInfoModal';
import { ProposalEditorLayout } from './layout';

type Proposal = z.infer<typeof proposalEncoder>;

// Utility function to handle tRPC validation errors
function handleValidationError(error: any, operationType: 'create' | 'update') {
  console.error(`Failed to ${operationType} proposal:`, error);

  // Check if error has field-specific validation errors
  if (
    error.data &&
    'cause' in error.data &&
    error.data.cause &&
    typeof error.data.cause === 'object' &&
    'fieldErrors' in error.data.cause
  ) {
    const fieldErrors = error.data.cause.fieldErrors as Record<string, string>;

    // Show individual error messages for each field, or combine if multiple
    const errorMessages = Object.values(fieldErrors);

    if (errorMessages.length === 1) {
      // Single error - show just the message
      toast.error({
        message: errorMessages[0],
      });
    } else {
      // Multiple errors - show with title
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
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [showBudgetInput, setShowBudgetInput] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [imageAttachments] = useState<ImageAttachment[]>([]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const editorRef = useRef<RichTextEditorRef>(null);
  const budgetInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  const utils = trpc.useUtils();
  const posthog = usePostHog();
  const t = useTranslations();

  const createProposalMutation = trpc.decision.createProposal.useMutation({
    onSuccess: async () => {
      // Track successful proposal creation
      if (posthog) {
        posthog.capture('create_proposal_success', {
          process_instance_id: instance.id,
          process_name: instance.process?.name,
        });
      }

      await utils.decision.listProposals.invalidate({
        processInstanceId: instance.id,
      });
      // Navigate after cache invalidation completes
      router.push(backHref);
    },
    onError: (error) => handleValidationError(error, 'create'),
  });

  const updateProposalMutation = trpc.decision.updateProposal.useMutation({
    onSuccess: async () => {
      await utils.decision.getProposal.invalidate({
        profileId: existingProposal?.profileId,
      });
      await utils.decision.listProposals.invalidate({
        processInstanceId: instance.id,
      });
      // Navigate after cache invalidation completes
      router.push(backHref);
    },
    onError: (error) => handleValidationError(error, 'update'),
  });

  const submitProposalMutation = trpc.decision.submitProposal.useMutation({
    onSuccess: async () => {
      // Track successful proposal submission
      if (posthog) {
        posthog.capture('submit_proposal_success', {
          process_instance_id: instance.id,
          process_name: instance.process?.name,
        });
      }

      await utils.decision.getProposal.invalidate({
        profileId: existingProposal?.profileId,
      });
      await utils.decision.listProposals.invalidate({
        processInstanceId: instance.id,
      });
      // Navigate after cache invalidation completes
      router.push(backHref);
    },
    onError: (error) => handleValidationError(error, 'update'),
  });

  // Check if we're editing a draft proposal (should show info modal and use submitProposal)
  const isDraft =
    isEditMode && existingProposal?.status === ProposalStatus.DRAFT;

  // Extract template data from the instance
  const proposalTemplate = instance.process?.processSchema?.proposalTemplate;
  const descriptionGuidance = instance.instanceData?.fieldValues
    ?.descriptionGuidance as string | undefined;

  // Extract proposal info from the instance field values
  const proposalInfoTitle = instance.instanceData?.fieldValues
    ?.proposalInfoTitle as string | undefined;
  const proposalInfoContent = instance.instanceData?.fieldValues
    ?.proposalInfoContent as string | undefined;

  // Get categories dynamically from the database
  const [categoriesData] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId: instance.id,
  });
  const { categories } = categoriesData;
  let budgetCapAmount: number | undefined;

  // Extract budget cap from the template if available
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
        budgetCapAmount = budgetProp.maximum as number;
      }
    }
  }

  // Also check for budgetCapAmount in instance data
  if (!budgetCapAmount && instance.instanceData?.fieldValues?.budgetCapAmount) {
    budgetCapAmount = instance.instanceData.fieldValues
      .budgetCapAmount as number;
  }

  const isBudgetRequired = (() => {
    // First check the proposal template schema
    if (
      proposalTemplate &&
      typeof proposalTemplate === 'object' &&
      'required' in proposalTemplate &&
      Array.isArray(proposalTemplate.required)
    ) {
      return proposalTemplate.required.includes('budget');
    }

    // Safe default: require budget for all proposals unless explicitly configured otherwise
    return true;
  })();

  // Parse proposal data for editing
  const parsedProposalData =
    isEditMode && existingProposal
      ? parseProposalData(existingProposal.proposalData)
      : null;

  // Use existing content if editing, otherwise use placeholder content
  const initialContent =
    isEditMode && parsedProposalData
      ? parsedProposalData.description
      : descriptionGuidance
        ? `<p>${descriptionGuidance}</p>`
        : undefined;

  // Update editor content when it changes
  const handleEditorUpdate = useCallback((content: string) => {
    setEditorContent(content);
  }, []);

  // Handle editor ready callback
  const handleEditorReady = useCallback((editor: any) => {
    setEditorInstance(editor);
  }, []);

  // Initialize form with existing proposal data if in edit mode
  useEffect(() => {
    if (
      isEditMode &&
      existingProposal &&
      parsedProposalData &&
      !initializedRef.current
    ) {
      const {
        title: existingTitle,
        description: existingDescription,
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

      // Set editor content state immediately
      if (existingDescription) {
        setEditorContent(existingDescription);
      }

      // Mark as initialized to prevent re-running
      initializedRef.current = true;
    }
  }, [isEditMode, existingProposal, parsedProposalData]);

  // Content setting is now handled by RichTextEditorContent component via the content prop

  // Show proposal info modal when creating a new proposal OR editing a draft
  useEffect(() => {
    const shouldShowModal = !isEditMode || isDraft;
    if (shouldShowModal && proposalInfoTitle && proposalInfoContent) {
      setShowInfoModal(true);
    }
  }, [isEditMode, isDraft, proposalInfoTitle, proposalInfoContent]);

  // Auto-focus budget input when it becomes visible
  useEffect(() => {
    if (showBudgetInput && budgetInputRef.current) {
      budgetInputRef.current.focus();
    }
  }, [showBudgetInput]);

  const handleCloseInfoModal = () => {
    setShowInfoModal(false);
  };

  const handleSubmitProposal = useCallback(async () => {
    const content = editorRef.current?.getHTML() || editorContent;

    setIsSubmitting(true);

    try {
      // Validate required fields
      const missingFields: string[] = [];

      if (!title || title.trim() === '') {
        missingFields.push('Title');
      }

      // Check for empty content (rich text editor can have various empty states)
      const isContentEmpty =
        !content ||
        content.trim() === '' ||
        content === '<p></p>' ||
        content === '<p><br></p>' ||
        content.replace(/<[^>]*>/g, '').trim() === '';

      if (isContentEmpty) {
        missingFields.push('Description');
      }

      if (isBudgetRequired && (budget === null || budget === undefined)) {
        missingFields.push('Budget');
      }

      // Validate budget cap if there's a limit
      if (
        budget !== null &&
        budget !== undefined &&
        budgetCapAmount &&
        budget > budgetCapAmount
      ) {
        toast.error({
          message: `Budget cannot exceed ${budgetCapAmount.toLocaleString()}`,
        });
        return;
      }

      if (missingFields.length > 0) {
        if (missingFields.length === 1) {
          toast.error({
            message: `${missingFields[0]} is required`,
          });
        } else {
          toast.error({
            title: 'Please complete the following required fields:',
            message: missingFields.join(', '),
          });
        }
        return;
      }

      // Extract image URLs from content and get attachment IDs
      const imageUrls = extractImageUrlsFromContent(content);
      const attachmentIds = extractAttachmentIdsFromUrls(
        imageUrls,
        imageAttachments,
      );

      // Create the proposal data structure
      const proposalData: Record<string, unknown> = {};

      // Always include required fields (they've been validated above)
      proposalData.title = title;
      proposalData.description = content;

      // Include category field if categories are available for this process
      if (categories && categories.length > 0) {
        proposalData.category = selectedCategory;
      }

      if (budget !== null && budget !== undefined) {
        proposalData.budget = budget;
      }

      if (isEditMode && existingProposal) {
        if (isDraft) {
          // Submit draft proposal - validates and transitions to 'submitted' status
          await submitProposalMutation.mutateAsync({
            proposalId: existingProposal.id,
            proposalData,
            attachmentIds,
          });
        } else {
          // Update existing submitted proposal - navigation handled in onSuccess callback
          await updateProposalMutation.mutateAsync({
            proposalId: existingProposal.id,
            data: {
              proposalData,
              attachmentIds, // Include attachment IDs for updates
            },
          });
        }
      } else {
        // Create new proposal - navigation handled in onSuccess callback
        await createProposalMutation.mutateAsync({
          processInstanceId: instance.id,
          proposalData,
          attachmentIds, // Include attachment IDs for new proposals
        });
      }
    } catch (error) {
      // Error handling is now done by the mutation's onError callbacks
      // This catch block handles any other unexpected errors
      console.error(
        `Failed to ${isEditMode ? 'update' : 'submit'} proposal:`,
        error,
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    editorContent,
    title,
    selectedCategory,
    budget,
    instance,
    createProposalMutation,
    updateProposalMutation,
    submitProposalMutation,
    isEditMode,
    isDraft,
    existingProposal,
    imageAttachments,
    isBudgetRequired,
    categories,
    budgetCapAmount,
  ]);

  return (
    <ProposalEditorLayout
      backHref={backHref}
      title={title}
      onSubmitProposal={handleSubmitProposal}
      isSubmitting={isSubmitting}
      isEditMode={isEditMode}
      isDraft={isDraft}
    >
      {/* Content */}
      <div className="flex flex-1 flex-col gap-12">
        {editorInstance && <RichTextEditorToolbar editor={editorInstance} />}
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {/* Title input */}
          <TextField
            type="text"
            value={title}
            onChange={(value) => setTitle(value)}
            inputProps={{
              placeholder: 'Untitled Proposal',
              className: 'border-0 p-0 font-serif text-title-lg',
            }}
          />

          {/* Category and Budget selectors */}
          <div className="flex gap-6">
            {categories && categories.length > 0 ? (
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
            ) : null}
            {!showBudgetInput ? (
              <Button
                variant="pill"
                color="pill"
                onPress={() => setShowBudgetInput(true)}
              >
                Add budget
              </Button>
            ) : null}
            {showBudgetInput && (
              <NumberField
                ref={budgetInputRef}
                value={budget}
                onChange={(value) => {
                  setBudget(value);
                }}
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

          <RichTextEditor
            ref={editorRef}
            extensions={getEditorExtensions()}
            content={initialContent || ''}
            onUpdate={handleEditorUpdate}
            placeholder={t('Write your proposal here...')}
            onEditorReady={handleEditorReady}
            editorClassName="w-full !max-w-[32rem] sm:min-w-[32rem] min-h-[40rem] px-0 py-4"
          />
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
