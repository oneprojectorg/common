'use client';

import { ProcessInstance } from '@/utils/decisionProcessTransforms';
import { parseProposalData } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import {
  RichTextEditorContent,
  RichTextEditorRef,
  RichTextEditorToolbar,
} from '../RichTextEditor';
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
  const [editorContent, setEditorContent] = useState('');
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const editorRef = useRef<RichTextEditorRef>(null);

  const createProposalMutation = trpc.decision.createProposal.useMutation();
  const updateProposalMutation = trpc.decision.updateProposal.useMutation();

  // Extract template data from the instance
  const proposalTemplate = instance.process?.processSchema?.proposalTemplate;
  const descriptionGuidance = instance.instanceData?.fieldValues
    ?.descriptionGuidance as string | undefined;

  // Get categories from instance data and budget cap from template
  const categories = instance.instanceData?.fieldValues?.categories as
    | string[]
    | undefined;
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

  // Parse proposal data for editing
  const parsedProposalData =
    isEditMode && existingProposal
      ? parseProposalData(existingProposal.proposalData)
      : null;

  // Use existing content if editing, otherwise use placeholder content
  const initialContent =
    isEditMode && parsedProposalData?.content
      ? parsedProposalData.content
      : descriptionGuidance
        ? `<p>${descriptionGuidance}</p>`
        : "<p>Start with the problem you're addressing, explain your solution, and describe the expected impact on our community...</p>";

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
    if (isEditMode && existingProposal && parsedProposalData) {
      const {
        title: existingTitle,
        content: existingContent,
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
      }

      // Set editor content state immediately
      if (existingContent) {
        setEditorContent(existingContent);
      }
    }
  }, [isEditMode, existingProposal, parsedProposalData]);

  // Set editor content when editor is ready and we have existing content
  useEffect(() => {
    if (editorInstance && isEditMode && parsedProposalData?.content) {
      editorInstance.commands.setContent(parsedProposalData.content);
    }
  }, [editorInstance, isEditMode, parsedProposalData?.content]);

  const handleSubmitProposal = useCallback(async () => {
    const content = editorRef.current?.getHTML() || editorContent;

    setIsSubmitting(true);

    try {
      // Create the proposal data structure
      const proposalData = {
        title,
        content,
        category: selectedCategory,
        budget: budget,
        // Add any additional fields that match the process's proposal template
      };

      if (isEditMode && existingProposal) {
        // Update existing proposal
        await updateProposalMutation.mutateAsync({
          proposalId: existingProposal.id,
          data: {
            proposalData,
          },
        });
      } else {
        // Create new proposal
        await createProposalMutation.mutateAsync({
          processInstanceId: instance.id,
          proposalData,
        });
      }

      // Navigate back to appropriate page
      router.push(backHref);
    } catch (error) {
      console.error(
        `Failed to ${isEditMode ? 'update' : 'submit'} proposal:`,
        error,
      );
      // TODO: Show error message to user
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
        {editorInstance && <RichTextEditorToolbar editor={editorInstance} />}
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
                placeholder="Select category"
                selectedKey={selectedCategory}
                onSelectionChange={(key) => setSelectedCategory(key as string)}
                className="w-auto"
              >
                {categories.map((cat) => (
                  <SelectItem key={cat} id={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </Select>
            ) : null}
            <button
              onClick={() => {
                const maxBudgetMsg = budgetCapAmount
                  ? ` (max: $${budgetCapAmount.toLocaleString()})`
                  : '';
                // TODO: replace with an input field
                const budgetStr = window.prompt(
                  `Enter budget amount (USD)${maxBudgetMsg}:`,
                  budget?.toString() || '',
                );
                if (budgetStr && !isNaN(Number(budgetStr))) {
                  const newBudget = Number(budgetStr);
                  if (budgetCapAmount && newBudget > budgetCapAmount) {
                    alert(
                      `Budget cannot exceed $${budgetCapAmount.toLocaleString()}`,
                    );
                    return;
                  }
                  setBudget(newBudget);
                }
              }}
              className="text-sm font-medium text-primary-teal hover:text-primary-tealBlack"
            >
              {budget ? `Budget: $${budget.toLocaleString()}` : 'Add budget'}
              {budgetCapAmount && (
                <span className="ml-1 text-xs text-gray-500">
                  (max: ${budgetCapAmount.toLocaleString()})
                </span>
              )}
            </button>
          </div>

          <RichTextEditorContent
            ref={editorRef}
            content={initialContent}
            onUpdate={handleEditorUpdate}
            onEditorReady={handleEditorReady}
            editorClassName="min-h-96 px-6 py-6 text-neutral-black placeholder:text-neutral-gray2"
          />
        </div>
      </div>
    </ProposalEditorLayout>
  );
}
