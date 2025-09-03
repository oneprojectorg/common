'use client';

import { ProcessInstance } from '@/utils/decisionProcessTransforms';
import {
  type ImageAttachment,
  extractAttachmentIdsFromUrls,
  extractImageUrlsFromContent,
} from '@/utils/proposalContentProcessor';
import { parseProposalData } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { NumberField } from '@op/ui/NumberField';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import { RichTextEditorContent, RichTextEditorRef } from '../RichTextEditor';
import { ProposalInfoModal } from './ProposalInfoModal';
import { ProposalRichTextToolbar } from './ProposalRichTextToolbar';
import { ProposalEditorLayout } from './layout';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalEditorProps {
  instance: ProcessInstance;
  backHref: string;
  existingProposal?: Proposal;
  isEditMode?: boolean;
}

export function ProposalEditor({
  instance,
  backHref,
  existingProposal,
  isEditMode = false,
}: ProposalEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [showBudgetInput, setShowBudgetInput] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>(
    [],
  );
  const [showInfoModal, setShowInfoModal] = useState(false);
  const editorRef = useRef<RichTextEditorRef>(null);
  const utils = trpc.useUtils();

  const createProposalMutation = trpc.decision.createProposal.useMutation({
    onError: (error) => {
      console.error('Failed to create proposal:', error);
      
      // Check if error has field-specific validation errors
      if (error.data && 'cause' in error.data && error.data.cause && typeof error.data.cause === 'object' && 'fieldErrors' in error.data.cause) {
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
          title: 'Failed to create proposal',
          message: error.message || 'An unexpected error occurred',
        });
      }
    },
  });

  const updateProposalMutation = trpc.decision.updateProposal.useMutation({
    onSuccess: async () => {
      utils.decision.getProposal.invalidate({
        proposalId: existingProposal?.id,
      });
      utils.decision.listProposals.invalidate({
        processInstanceId: instance.id,
      });
    },
    onError: (error) => {
      console.error('Failed to update proposal:', error);
      
      // Check if error has field-specific validation errors
      if (error.data && 'cause' in error.data && error.data.cause && typeof error.data.cause === 'object' && 'fieldErrors' in error.data.cause) {
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
          title: 'Failed to update proposal',
          message: error.message || 'An unexpected error occurred',
        });
      }
    },
  });

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

  // Check if budget is required - simplified approach with safe default
  const isBudgetRequired = (() => {
    // First check the proposal template schema
    if (proposalTemplate && 
        typeof proposalTemplate === 'object' && 
        'required' in proposalTemplate &&
        Array.isArray(proposalTemplate.required)) {
      return proposalTemplate.required.includes('budget');
    }
    
    // Safe default: require budget for all proposals unless explicitly configured otherwise
    // This ensures backward compatibility with existing processes
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
      ? (parsedProposalData.description || parsedProposalData.content)
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

  // Handle image attachment uploads
  const handleImageUploaded = useCallback((attachment: ImageAttachment) => {
    setImageAttachments((prev) => [...prev, attachment]);
  }, []);

  // Initialize form with existing proposal data if in edit mode
  useEffect(() => {
    if (isEditMode && existingProposal && parsedProposalData) {
      const {
        title: existingTitle,
        description: existingDescription,
        content: existingContent, // Keep for backward compatibility
        category: existingCategory,
        budget: existingBudget,
      } = parsedProposalData;

      if (existingTitle) {
        setTitle(existingTitle);
      }
      if (existingCategory) {
        setSelectedCategory(existingCategory);
      }
      if (existingBudget) {
        setBudget(existingBudget);
        setShowBudgetInput(true);
      }

      // Set editor content state immediately (prefer description over content for backward compatibility)
      const contentToSet = existingDescription || existingContent;
      if (contentToSet) {
        setEditorContent(contentToSet);
      }
    }
  }, [isEditMode, existingProposal, parsedProposalData]);

  // Show budget input if budget is required (separate effect)
  useEffect(() => {
    if (isBudgetRequired && !showBudgetInput) {
      setShowBudgetInput(true);
    }
  }, [isBudgetRequired, showBudgetInput]);

  // Set editor content when editor is ready and we have existing content
  useEffect(() => {
    if (editorInstance && isEditMode && parsedProposalData) {
      const contentToSet = parsedProposalData.description || parsedProposalData.content;
      if (contentToSet) {
        editorInstance.commands.setContent(contentToSet);
      }
    }
  }, [editorInstance, isEditMode, parsedProposalData]);

  // Show proposal info modal when creating a new proposal (not editing)
  useEffect(() => {
    if (!isEditMode && proposalInfoTitle && proposalInfoContent) {
      setShowInfoModal(true);
    }
  }, [isEditMode, proposalInfoTitle, proposalInfoContent]);

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
      const isContentEmpty = !content || 
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
      proposalData.description = content; // The schema expects 'description' field
      
      // Only include optional fields if they have values
      if (selectedCategory) {
        proposalData.category = selectedCategory;
      }
      
      if (budget !== null && budget !== undefined) {
        proposalData.budget = budget;
      }

      if (isEditMode && existingProposal) {
        // Update existing proposal
        await updateProposalMutation.mutateAsync({
          proposalId: existingProposal.id,
          data: {
            proposalData,
            attachmentIds, // Include attachment IDs for updates
          },
        });
      } else {
        // Create new proposal
        await createProposalMutation.mutateAsync({
          processInstanceId: instance.id,
          proposalData,
          attachmentIds, // Include attachment IDs for new proposals
        });
      }

      // Navigate back to appropriate page
      router.push(backHref);
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
    isEditMode,
    existingProposal,
    backHref,
    router,
    imageAttachments,
    isBudgetRequired,
  ]);

  return (
    <ProposalEditorLayout
      backHref={backHref}
      title={title}
      onSubmitProposal={handleSubmitProposal}
      isSubmitting={isSubmitting}
      isEditMode={isEditMode}
    >
      {/* Content */}
      <div className="flex flex-1 flex-col gap-12">
        {editorInstance && (
          <ProposalRichTextToolbar
            editor={editorInstance}
            onImageUploaded={handleImageUploaded}
          />
        )}
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
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
                placeholder="Select category"
                selectedKey={selectedCategory}
                onSelectionChange={(key) => setSelectedCategory(key as string)}
                className="w-auto"
              >
                {categories.map((category) => (
                  <SelectItem key={category.id} id={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </Select>
            ) : null}
            {!showBudgetInput && !isBudgetRequired ? (
              <Button
                variant="pill"
                color="pill"
                onPress={() => setShowBudgetInput(true)}
              >
                Add budget
              </Button>
            ) : null}
            {(showBudgetInput || isBudgetRequired) && (
              <NumberField
                value={budget}
                onChange={(value) => {
                  if (
                    value !== null &&
                    budgetCapAmount &&
                    value > budgetCapAmount
                  ) {
                    // Don't allow values exceeding the cap
                    return;
                  }
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

          <RichTextEditorContent
            ref={editorRef}
            content={initialContent}
            onUpdate={handleEditorUpdate}
            placeholder="Write your proposal here..."
            onEditorReady={handleEditorReady}
            editorClassName="w-[32rem] px-6 py-6 text-neutral-black placeholder:text-neutral-gray2"
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
