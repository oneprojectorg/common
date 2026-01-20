'use client';

import { generateCollabDocId } from '@/hooks/useTiptapCollab';
import {
  type ImageAttachment,
  extractAttachmentIdsFromUrls,
  extractImageUrlsFromContent,
} from '@/utils/proposalContentProcessor';
import { parseProposalData } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import {
  type ProcessInstance,
  ProposalStatus,
  type proposalEncoder,
} from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { NumberField } from '@op/ui/NumberField';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import type { Editor } from '@tiptap/react';
import { useRouter } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import {
  CollaborativeEditor,
  type CollaborativeEditorRef,
  RichTextEditorToolbar,
  getProposalExtensions,
} from '../RichTextEditor';
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

  // Form state
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [showBudgetInput, setShowBudgetInput] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [imageAttachments] = useState<ImageAttachment[]>([]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs
  const editorRef = useRef<CollaborativeEditorRef>(null);
  const budgetInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  // Check if editing a draft (should show info modal and use submitProposal)
  const isDraft =
    isEditMode && existingProposal?.status === ProposalStatus.DRAFT;

  // Generate or use existing collaboration document ID
  const collabDocId = useMemo(() => {
    const existingDocId = (
      existingProposal?.proposalData as Record<string, unknown>
    )?.collaborationDocId as string | undefined;

    if (isEditMode && existingDocId) {
      return existingDocId;
    }
    // Generate new docId for new proposals or legacy proposals without one
    return generateCollabDocId(instance.id, existingProposal?.id);
  }, [
    instance.id,
    isEditMode,
    existingProposal?.id,
    existingProposal?.proposalData,
  ]);

  // Editor extensions - memoized with collaborative flag
  const editorExtensions = useMemo(
    () => getProposalExtensions({ collaborative: true }),
    [],
  );

  // Extract template data from the instance
  const descriptionGuidance = instance.instanceData?.fieldValues
    ?.descriptionGuidance as string | undefined;
  const proposalInfoTitle = instance.instanceData?.fieldValues
    ?.proposalInfoTitle as string | undefined;
  const proposalInfoContent = instance.instanceData?.fieldValues
    ?.proposalInfoContent as string | undefined;

  // Get categories from database
  const [categoriesData] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId: instance.id,
  });
  const { categories } = categoriesData;

  // Extract budget cap from template or instance data
  const budgetCapAmount = useMemo(() => {
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
          return budgetProp.maximum as number;
        }
      }
    }

    return instance.instanceData?.fieldValues?.budgetCapAmount as
      | number
      | undefined;
  }, [instance]);

  // Parse existing proposal data for editing
  const parsedProposalData = useMemo(
    () =>
      isEditMode && existingProposal
        ? parseProposalData(existingProposal.proposalData)
        : null,
    [isEditMode, existingProposal],
  );

  // Initial content for editor
  const initialContent = useMemo(() => {
    if (isEditMode && parsedProposalData?.description) {
      return parsedProposalData.description;
    }
    return descriptionGuidance ? `<p>${descriptionGuidance}</p>` : '';
  }, [isEditMode, parsedProposalData, descriptionGuidance]);

  // Mutations
  const createProposalMutation = trpc.decision.createProposal.useMutation({
    onError: (error) => handleMutationError(error, 'create'),
  });

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
      if (existingDescription) {
        setEditorContent(existingDescription);
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

  // Handlers
  const handleEditorUpdate = useCallback((content: string) => {
    setEditorContent(content);
  }, []);

  const handleEditorReady = useCallback((editor: Editor) => {
    setEditorInstance(editor);
  }, []);

  const handleCloseInfoModal = useCallback(() => {
    setShowInfoModal(false);
  }, []);

  const handleSubmitProposal = useCallback(async () => {
    const content = editorRef.current?.getHTML() || editorContent;
    setIsSubmitting(true);

    try {
      const imageUrls = extractImageUrlsFromContent(content);
      const attachmentIds = extractAttachmentIdsFromUrls(
        imageUrls,
        imageAttachments,
      );

      const proposalData: Record<string, unknown> = {
        title,
        description: content,
        collaborationDocId: collabDocId,
      };

      if (categories && categories.length > 0) {
        proposalData.category = selectedCategory;
      }

      if (budget !== null) {
        proposalData.budget = budget;
      }

      if (isEditMode && existingProposal) {
        // Update existing proposal
        await updateProposalMutation.mutateAsync({
          proposalId: existingProposal.id,
          data: { proposalData, attachmentIds },
        });

        // If draft, also submit (transition to submitted status)
        if (isDraft) {
          await submitProposalMutation.mutateAsync({
            proposalId: existingProposal.id,
          });
        }
      } else {
        // Create new proposal as draft, then submit
        const draft = await createProposalMutation.mutateAsync({
          processInstanceId: instance.id,
          proposalData,
          attachmentIds,
        });

        await submitProposalMutation.mutateAsync({
          proposalId: draft.id,
        });
      }
    } catch (error) {
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
    collabDocId,
    categories,
    instance.id,
    isEditMode,
    existingProposal,
    isDraft,
    imageAttachments,
    createProposalMutation,
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
              className: 'border-0 p-0 font-serif text-title-lg',
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
            ref={editorRef}
            docId={collabDocId}
            extensions={editorExtensions}
            content={initialContent}
            onUpdate={handleEditorUpdate}
            onEditorReady={handleEditorReady}
            placeholder={t('Write your proposal here...')}
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
