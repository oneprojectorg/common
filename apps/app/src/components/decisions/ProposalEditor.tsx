'use client';

import { useFileUpload } from '@/hooks/useFileUpload';
import { ProcessInstance } from '@/utils/decisionProcessTransforms';
import { parseProposalData } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import Blockquote from '@tiptap/extension-blockquote';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Strike from '@tiptap/extension-strike';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import { ProposalEditorLayout } from './layout';
import { SlashCommands } from './SlashCommands';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Floating toolbar state
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);
  const [floatingToolbarPosition, setFloatingToolbarPosition] = useState({
    top: 0,
    left: 0,
  });

  // File upload setup for images only
  const { uploadFile, getUploadedAttachmentIds } = useFileUpload({
    acceptedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    maxFiles: 10,
    maxSizePerFile: 4 * 1024 * 1024, // 4MB
  });

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
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Heading.configure({
        levels: [1, 2, 3],
      }),
      Underline,
      Strike,
      Blockquote,
      HorizontalRule,
      SlashCommands,
    ],
    content: placeholderContent,
    editorProps: {
      attributes: {
        class:
          'prose prose-lg max-w-none focus:outline-none min-h-96 px-6 py-6 text-neutral-black placeholder:text-neutral-gray2',
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
        attachmentIds: getUploadedAttachmentIds(),
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
    getUploadedAttachmentIds,
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

  const handleImageUpload = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0 || !editor) return;

      const file = files[0];
      if (!file) return;

      try {
        const uploadResult = await uploadFile(file);
        // Insert the uploaded image into the editor
        editor.chain().focus().setImage({ src: uploadResult.url }).run();
      } catch (error) {
        console.error('Failed to upload image:', error);
      }

      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [editor, uploadFile],
  );

  // Handle text selection for floating toolbar
  const handleSelectionChange = useCallback(() => {
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;
    const { from, to } = selection;

    // Show floating toolbar only if there's a text selection
    if (from === to) {
      setShowFloatingToolbar(false);
      return;
    }

    // Get the DOM selection to calculate position
    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) {
      setShowFloatingToolbar(false);
      return;
    }

    const range = domSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      setShowFloatingToolbar(false);
      return;
    }

    // Position the floating toolbar above the selection
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;

    setFloatingToolbarPosition({
      top: rect.top + scrollTop - 50, // Position above selection
      left: rect.left + scrollLeft + rect.width / 2 - 200, // Center horizontally (wider toolbar)
    });

    setShowFloatingToolbar(true);
  }, [editor]);

  // Set up selection listener for floating toolbar
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      // Use setTimeout to ensure the DOM selection is updated
      setTimeout(handleSelectionChange, 0);
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    editor.on('transaction', handleSelectionUpdate);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('transaction', handleSelectionUpdate);
    };
  }, [editor, handleSelectionChange]);

  // Hide floating toolbar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showFloatingToolbar) {
        const target = event.target as HTMLElement;
        if (
          !target.closest('[data-floating-toolbar]') &&
          !target.closest('.ProseMirror')
        ) {
          setShowFloatingToolbar(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFloatingToolbar]);

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
      <div className="border-b border-neutral-gray1 px-6 py-2">
        <div className="flex flex-wrap items-center justify-center gap-1">
          {/* Undo/Redo */}
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

          {/* Headings */}
          <button
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : ''}`}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </button>
          <button
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''}`}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </button>
          <button
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200' : ''}`}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </button>

          <div className="mx-2 h-6 w-px bg-gray-300" />

          {/* Text Formatting */}
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
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive('underline') ? 'bg-gray-200' : ''}`}
            title="Underline"
          >
            <UnderlineIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive('strike') ? 'bg-gray-200' : ''}`}
            title="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive('code') ? 'bg-gray-200' : ''}`}
            title="Code"
          >
            <Code className="h-4 w-4" />
          </button>

          <div className="mx-2 h-6 w-px bg-gray-300" />

          {/* Lists */}
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
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive('blockquote') ? 'bg-gray-200' : ''}`}
            title="Blockquote"
          >
            <Quote className="h-4 w-4" />
          </button>

          <div className="mx-2 h-6 w-px bg-gray-300" />

          {/* Text Alignment */}
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

          {/* Insert Elements */}
          <button
            onClick={addLink}
            className={`rounded p-2 hover:bg-gray-100 ${editor.isActive('link') ? 'bg-gray-200' : ''}`}
            title="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleImageUpload}
            className="rounded p-2 hover:bg-gray-100"
            title="Add Image"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="rounded p-2 hover:bg-gray-100"
            title="Add Horizontal Rule"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Floating Toolbar */}
      {showFloatingToolbar && editor && (
        <div
          data-floating-toolbar
          className="fixed z-50 flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg"
          style={{
            top: `${floatingToolbarPosition.top}px`,
            left: `${floatingToolbarPosition.left}px`,
            transform: 'translateX(-50%)',
            maxWidth: '400px',
          }}
        >
          {/* Headings */}
          <button
            onClick={() => {
              editor.chain().focus().toggleHeading({ level: 1 }).run();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Heading 1"
          >
            <Heading1 className="size-4" />
          </button>
          <button
            onClick={() => {
              editor.chain().focus().toggleHeading({ level: 2 }).run();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Heading 2"
          >
            <Heading2 className="size-4" />
          </button>
          <button
            onClick={() => {
              editor.chain().focus().toggleHeading({ level: 3 }).run();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Heading 3"
          >
            <Heading3 className="size-4" />
          </button>

          <div className="mx-1 h-4 w-px bg-gray-300" />

          {/* Text Formatting */}
          <button
            onClick={() => {
              editor.chain().focus().toggleBold().run();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('bold') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Bold"
          >
            <Bold className="size-4" />
          </button>
          <button
            onClick={() => {
              editor.chain().focus().toggleItalic().run();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('italic') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Italic"
          >
            <Italic className="size-4" />
          </button>
          <button
            onClick={() => {
              editor.chain().focus().toggleUnderline().run();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('underline') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Underline"
          >
            <UnderlineIcon className="size-4" />
          </button>
          <button
            onClick={() => {
              editor.chain().focus().toggleStrike().run();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('strike') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Strikethrough"
          >
            <Strikethrough className="size-4" />
          </button>
          <button
            onClick={() => {
              editor.chain().focus().toggleCode().run();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('code') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Code"
          >
            <Code className="size-4" />
          </button>

          <div className="mx-1 h-4 w-px bg-gray-300" />

          {/* Lists and Blockquote */}
          <button
            onClick={() => {
              editor.chain().focus().toggleBulletList().run();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('bulletList') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Bullet List"
          >
            <List className="size-4" />
          </button>
          <button
            onClick={() => {
              editor.chain().focus().toggleOrderedList().run();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('orderedList') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Numbered List"
          >
            <ListOrdered className="size-4" />
          </button>
          <button
            onClick={() => {
              editor.chain().focus().toggleBlockquote().run();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('blockquote') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Blockquote"
          >
            <Quote className="size-4" />
          </button>

          <div className="mx-1 h-4 w-px bg-gray-300" />

          {/* Text Alignment */}
          <button
            onClick={() => {
              editor.chain().focus().setTextAlign('left').run();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Align Left"
          >
            <AlignLeft className="size-4" />
          </button>
          <button
            onClick={() => {
              editor.chain().focus().setTextAlign('center').run();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Align Center"
          >
            <AlignCenter className="size-4" />
          </button>
          <button
            onClick={() => {
              editor.chain().focus().setTextAlign('right').run();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Align Right"
          >
            <AlignRight className="size-4" />
          </button>

          <div className="mx-1 h-4 w-px bg-gray-300" />

          {/* Link */}
          <button
            onClick={() => {
              addLink();
              handleSelectionChange();
            }}
            className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('link') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
            title="Add Link"
          >
            <LinkIcon className="size-4" />
          </button>
        </div>
      )}

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

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
          <div>
            <EditorContent
              className="[&>div]:px-0 [&>div]:py-0"
              editor={editor}
            />
          </div>
        </div>
      </div>
    </ProposalEditorLayout>
  );
}
