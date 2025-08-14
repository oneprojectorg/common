'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Code,
  Undo,
  Redo,
  ChevronLeft,
} from 'lucide-react';
import { formatRelativeTime } from '../utils';

interface ProposalEditorProps {
  instanceId: string;
  backHref: string;
}

export function ProposalEditor({
  instanceId,
  backHref,
}: ProposalEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState('Untitled Proposal');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [budget, setBudget] = useState<number | null>(null);

  const createProposalMutation = trpc.decision.createProposal.useMutation();

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
    content: '<p>Start with the problem you\'re addressing, explain your solution, and describe the expected impact on our community...</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-96 px-4 py-4',
      },
    },
    onUpdate: () => {
      // Auto-save functionality could go here
      setLastSaved(new Date());
    },
    immediatelyRender: false,
  });


  const handleSubmitProposal = useCallback(async () => {
    if (!editor) return;
    
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

      await createProposalMutation.mutateAsync({
        processInstanceId: instanceId,
        proposalData,
      });
      
      // Navigate back to decision instance page
      router.push(backHref);
    } catch (error) {
      console.error('Failed to submit proposal:', error);
      // TODO: Show error message to user
    } finally {
      setIsSubmitting(false);
    }
  }, [editor, title, selectedCategory, budget, instanceId, createProposalMutation, backHref, router]);

  const addLink = useCallback(() => {
    const previousUrl = editor?.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;

    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        {/* Header skeleton */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="h-6 w-16 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="flex items-center gap-3">
            <div className="h-10 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
          </div>
        </div>
        
        {/* Loading message */}
        <div className="flex flex-1 items-center justify-center">
          <div className="text-gray-500">Loading editor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <button
          onClick={() => router.push(backHref)}
          className="flex items-center gap-2 text-sm text-primary-teal hover:text-primary-tealBlack"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-center text-lg font-medium bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary-teal rounded px-2 py-1"
          placeholder="Untitled Proposal"
        />

        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-xs text-gray-500">
              Saved {formatRelativeTime(lastSaved)} ago
            </span>
          )}
          <Button
            color="primary"
            onPress={handleSubmitProposal}
            isDisabled={isSubmitting}
            className="px-4 py-2"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Proposal'}
          </Button>
          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-600">U</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-gray-200 px-6 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </button>
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('bold') ? 'bg-gray-200' : ''}`}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('italic') ? 'bg-gray-200' : ''}`}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('bulletList') ? 'bg-gray-200' : ''}`}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('orderedList') ? 'bg-gray-200' : ''}`}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`p-2 rounded hover:bg-gray-100 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200' : ''}`}
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`p-2 rounded hover:bg-gray-100 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200' : ''}`}
            title="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`p-2 rounded hover:bg-gray-100 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200' : ''}`}
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </button>
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          <button
            onClick={addLink}
            className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('link') ? 'bg-gray-200' : ''}`}
            title="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('code') ? 'bg-gray-200' : ''}`}
            title="Code"
          >
            <Code className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-4xl">
          {/* Category and Budget selectors */}
          <div className="mb-6 flex gap-4">
            <button 
              onClick={() => {
                const category = window.prompt('Enter category:', selectedCategory || '');
                if (category) setSelectedCategory(category);
              }}
              className="text-primary-teal hover:text-primary-tealBlack text-sm font-medium"
            >
              {selectedCategory || 'Select category'}
            </button>
            <button 
              onClick={() => {
                const budgetStr = window.prompt('Enter budget amount (USD):', budget?.toString() || '');
                if (budgetStr && !isNaN(Number(budgetStr))) {
                  setBudget(Number(budgetStr));
                }
              }}
              className="text-primary-teal hover:text-primary-tealBlack text-sm font-medium"
            >
              {budget ? `Budget: $${budget.toLocaleString()}` : 'Add budget'}
            </button>
          </div>

          {/* Editor */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}