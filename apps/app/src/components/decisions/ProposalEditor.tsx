'use client';

import { ProcessInstance } from '@/utils/decisionProcessTransforms';
import { parseProposalData } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo,
  Undo,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';

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

  // Use descriptionGuidance as placeholder content if available
  const placeholderContent = descriptionGuidance
    ? `<p>${descriptionGuidance}</p>`
    : "<p>Start with the problem you're addressing, explain your solution, and describe the expected impact on our community...</p>";

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: placeholderContent,
    editorProps: {
      attributes: {
        class:
          'prose prose-lg max-w-none focus:outline-none min-h-96 px-4 py-4',
      },
    },
    onUpdate: () => {
      // Auto-save functionality could go here
    },
    immediatelyRender: false,
  });

  // Initialize form with existing proposal data if in edit mode
  useEffect(() => {
    if (isEditMode && existingProposal && editor) {
      const {
        title: existingTitle,
        content: existingContent,
        category: existingCategory,
        budget: existingBudget,
      } = parseProposalData(existingProposal.proposalData);

      if (existingTitle) {
        setTitle(existingTitle);
      }
      if (existingCategory) {
        setSelectedCategory(existingCategory);
      }
      if (existingBudget) {
        setBudget(existingBudget);
      }

      // Set editor content
      if (existingContent) {
        editor.commands.setContent(existingContent);
      }
    }
  }, [isEditMode, existingProposal, editor]);

  const handleSubmitProposal = useCallback(async () => {
    if (!editor) {
      return;
    }

    setIsSubmitting(true);

    try {
      const content = editor.getHTML();

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
    editor,
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

  const addLink = useCallback(() => {
    const previousUrl = editor?.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor
      ?.chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) {
    return (
      <ProposalEditorLayout
        backHref={backHref}
        title={title}
        onSubmitProposal={handleSubmitProposal}
        isSubmitting={isSubmitting}
        isEditMode={isEditMode}
      >
        {/* Loading message */}
        <div className="flex flex-1 items-center justify-center">
          <div className="text-gray-500">Loading editor...</div>
        </div>
      </ProposalEditorLayout>
    );
  }

  return (
    <ProposalEditorLayout
      backHref={backHref}
      title={title}
      onSubmitProposal={handleSubmitProposal}
      isSubmitting={isSubmitting}
      isEditMode={isEditMode}
    >
      {/* Toolbar */}
      <div className="flex justify-evenly border-b border-neutral-gray1 px-6 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="rounded p-2 hover:bg-gray-100 disabled:opacity-50"
            title="Undo"
          >
            <Undo className="size-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="rounded p-2 hover:bg-gray-100 disabled:opacity-50"
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </button>

          <div className="mx-2 h-6 w-px bg-gray-300" />

          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive('bold') ? 'bg-gray-200' : ''}`}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive('italic') ? 'bg-gray-200' : ''}`}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>

          <div className="mx-2 h-6 w-px bg-gray-300" />

          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive('bulletList') ? 'bg-gray-200' : ''}`}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive('orderedList') ? 'bg-gray-200' : ''}`}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </button>

          <div className="mx-2 h-6 w-px bg-gray-300" />

          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200' : ''}`}
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200' : ''}`}
            title="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200' : ''}`}
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </button>

          <div className="mx-2 h-6 w-px bg-gray-300" />

          <button
            onClick={addLink}
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive('link') ? 'bg-gray-200' : ''}`}
            title="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive('code') ? 'bg-gray-200' : ''}`}
            title="Code"
          >
            <Code className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-8">
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

          {/* Editor */}
          <EditorContent
            className="[&>div]:px-0 [&>div]:py-0"
            editor={editor}
          />
        </div>
      </div>
    </ProposalEditorLayout>
  );
}
