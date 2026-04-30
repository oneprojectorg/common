'use client';

import type { Editor } from '@tiptap/react';
import { useCallback } from 'react';
import {
  LuAlignCenter,
  LuAlignLeft,
  LuAlignRight,
  LuBold,
  LuCode,
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuItalic,
  LuLink,
  LuList,
  LuListOrdered,
  LuQuote,
  LuStrikethrough,
  LuUnderline,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

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
  const t = useTranslations();

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
      className="fixed z-[9999999] flex items-center gap-1 overflow-x-auto rounded-lg border bg-white p-1.5 whitespace-nowrap shadow-lg"
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
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Heading 1')}
      >
        <LuHeading1 className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Heading 2')}
      >
        <LuHeading2 className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleHeading({ level: 3 }).run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Heading 3')}
      >
        <LuHeading3 className="size-4" />
      </button>

      <div className="mx-1 h-4 w-px bg-gray-300" />

      {/* Text Formatting */}
      <button
        onClick={() => {
          editor.chain().focus().toggleBold().run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('bold') ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Bold')}
      >
        <LuBold className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleItalic().run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('italic') ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Italic')}
      >
        <LuItalic className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleUnderline().run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('underline') ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Underline')}
      >
        <LuUnderline className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleStrike().run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('strike') ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Strikethrough')}
      >
        <LuStrikethrough className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleCode().run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('code') ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Code')}
      >
        <LuCode className="size-4" />
      </button>

      <div className="mx-1 h-4 w-px bg-gray-300" />

      {/* Lists and Blockquote */}
      <button
        onClick={() => {
          editor.chain().focus().toggleBulletList().run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('bulletList') ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Bullet List')}
      >
        <LuList className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleOrderedList().run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('orderedList') ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Numbered List')}
      >
        <LuListOrdered className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().toggleBlockquote().run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('blockquote') ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Blockquote')}
      >
        <LuQuote className="size-4" />
      </button>

      <div className="mx-1 h-4 w-px bg-gray-300" />

      {/* Text Alignment */}
      <button
        onClick={() => {
          editor.chain().focus().setTextAlign('left').run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Align Left')}
      >
        <LuAlignLeft className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().setTextAlign('center').run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Align Center')}
      >
        <LuAlignCenter className="size-4" />
      </button>
      <button
        onClick={() => {
          editor.chain().focus().setTextAlign('right').run();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Align Right')}
      >
        <LuAlignRight className="size-4" />
      </button>

      <div className="mx-1 h-4 w-px bg-gray-300" />

      {/* Link */}
      <button
        onClick={() => {
          addLink();
          onSelectionChange();
        }}
        className={`rounded p-1.5 hover:bg-gray-100 ${editor.isActive('link') ? 'bg-gray-200 text-foreground' : 'text-foreground'}`}
        title={t('Add Link')}
      >
        <LuLink className="size-4" />
      </button>
    </div>
  );
}
