'use client';

import type { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react';
import { useCallback } from 'react';

export interface RichTextEditorFloatingToolbarProps {
  editor: Editor | null;
  isVisible: boolean;
  position: { top: number; left: number };
  onSelectionChange: () => void;
}

export function RichTextEditorFloatingToolbar({
  editor,
  isVisible,
  position,
  onSelectionChange,
}: RichTextEditorFloatingToolbarProps) {
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

  if (!editor || !isVisible) {
    return null;
  }

  return (
    <div
      data-floating-toolbar
      className="fixed z-[9999999] flex items-center gap-1 overflow-x-auto whitespace-nowrap rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        minWidth: 'max-content',
      }}
    >
      {/* Headings */}
      <button
        onClick={() => {
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
        title="Heading 1"
      >
        <Heading1 className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
        title="Heading 2"
      >
        <Heading2 className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleHeading({ level: 3 }).run();
          onSelectionChange();
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
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('bold') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
        title="Bold"
      >
        <Bold className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleItalic().run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('italic') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
        title="Italic"
      >
        <Italic className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleUnderline().run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('underline') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
        title="Underline"
      >
        <UnderlineIcon className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleStrike().run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('strike') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
        title="Strikethrough"
      >
        <Strikethrough className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleCode().run();
          onSelectionChange();
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
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('bulletList') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
        title="Bullet List"
      >
        <List className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleOrderedList().run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('orderedList') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
        title="Numbered List"
      >
        <ListOrdered className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleBlockquote().run();
          onSelectionChange();
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
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
        title="Align Left"
      >
        <AlignLeft className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().setTextAlign('center').run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
        title="Align Center"
      >
        <AlignCenter className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().setTextAlign('right').run();
          onSelectionChange();
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
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('link') ? 'bg-gray-200 text-neutral-black' : 'text-neutral-charcoal'}`}
        title="Add Link"
      >
        <LinkIcon className="size-4" />
      </button>
    </div>
  );
}
