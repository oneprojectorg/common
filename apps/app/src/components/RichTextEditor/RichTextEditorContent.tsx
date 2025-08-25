'use client';

import Blockquote from '@tiptap/extension-blockquote';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Strike from '@tiptap/extension-strike';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useImperativeHandle, forwardRef } from 'react';

import { SlashCommands } from '../decisions/SlashCommands';
import { IframelyExtension } from '../decisions/IframelyExtension';
import { RichTextEditorFloatingToolbar } from './RichTextEditorFloatingToolbar';
import { useRichTextEditorFloatingToolbar } from './useRichTextEditorFloatingToolbar';

export interface RichTextEditorContentProps {
  content?: string;
  placeholder?: string;
  onUpdate?: (content: string) => void;
  onChange?: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
  className?: string;
  editorClassName?: string;
  readOnly?: boolean;
  immediatelyRender?: boolean;
}

export interface RichTextEditorRef {
  getHTML: () => string;
  setContent: (content: string) => void;
  focus: () => void;
  blur: () => void;
  isEmpty: () => boolean;
  clear: () => void;
  editor: Editor | null;
}

export const RichTextEditorContent = forwardRef<RichTextEditorRef, RichTextEditorContentProps>(({
  content = '',
  placeholder: _placeholder = 'Start writing...',
  onUpdate,
  onChange,
  onEditorReady,
  className = '',
  editorClassName = '',
  readOnly = false,
  immediatelyRender = false,
}, ref) => {
  // Configure extensions - all features always enabled
  const extensions = [
    StarterKit,
    Link.configure({
      openOnClick: false,
      linkOnPaste: false, // Disable auto-linking on paste to let Iframely extension handle it
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
    IframelyExtension,
  ];

  const editor = useEditor({
    extensions,
    content,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: `prose prose-lg max-w-none focus:outline-none ${editorClassName || 'min-h-96 px-6 py-6 text-neutral-black placeholder:text-neutral-gray2'}`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onUpdate?.(html);
      onChange?.(html);
    },
    immediatelyRender,
  });

  // Expose editor methods through ref
  useImperativeHandle(ref, () => ({
    getHTML: () => editor?.getHTML() || '',
    setContent: (newContent: string) => editor?.commands.setContent(newContent),
    focus: () => editor?.commands.focus(),
    blur: () => editor?.commands.blur(),
    isEmpty: () => editor?.isEmpty || false,
    clear: () => editor?.commands.clearContent(),
    editor,
  }), [editor]);

  // Set initial content
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Floating toolbar hook - always enabled
  const {
    isVisible: floatingToolbarVisible,
    position: floatingToolbarPosition,
    handleSelectionChange,
  } = useRichTextEditorFloatingToolbar({
    editor,
    enabled: true,
  });

  if (!editor) {
    return (
      <div className={`flex flex-1 items-center justify-center ${className}`}>
        <div className="text-gray-500">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <EditorContent
        className="[&>div]:px-0 [&>div]:py-0"
        editor={editor}
      />
      
      <RichTextEditorFloatingToolbar
        editor={editor}
        isVisible={floatingToolbarVisible}
        position={floatingToolbarPosition}
        onSelectionChange={handleSelectionChange}
      />
    </div>
  );
});

RichTextEditorContent.displayName = 'RichTextEditorContent';