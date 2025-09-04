'use client';

import Blockquote from '@tiptap/extension-blockquote';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Strike from '@tiptap/extension-strike';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { forwardRef, useEffect, useImperativeHandle } from 'react';

import { IframelyExtension } from '../decisions/IframelyExtension';
import { SlashCommands } from '../decisions/SlashCommands';

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

export const RichTextEditorContent = forwardRef<
  RichTextEditorRef,
  RichTextEditorContentProps
>(
  (
    {
      content = '',
      placeholder: _placeholder = 'Start writing...',
      onUpdate,
      onChange,
      onEditorReady,
      className = '',
      editorClassName = '',
      readOnly = false,
      immediatelyRender = false,
    },
    ref,
  ) => {
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
          class: `prose prose-lg max-w-none focus:outline-none break-words overflow-wrap-anywhere ${editorClassName || 'min-h-96 px-6 py-6 text-neutral-black placeholder:text-neutral-gray2'}`,
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
    useImperativeHandle(
      ref,
      () => ({
        getHTML: () => editor?.getHTML() || '',
        setContent: (newContent: string) =>
          editor?.commands.setContent(newContent),
        focus: () => editor?.commands.focus(),
        blur: () => editor?.commands.blur(),
        isEmpty: () => editor?.isEmpty || false,
        clear: () => editor?.commands.clearContent(),
        editor,
      }),
      [editor],
    );

    // Set initial content only once when editor is first created
    useEffect(() => {
      if (editor && content) {
        const currentContent = editor.getHTML();
        if (currentContent === '' || currentContent === '<p></p>') {
          editor.commands.setContent(content);
        }
      }
    }, [editor]); // Only depend on editor, not content

    // Notify parent when editor is ready
    useEffect(() => {
      if (editor && onEditorReady) {
        onEditorReady(editor);
      }
    }, [editor, onEditorReady]);

    if (!editor) {
      return (
        <div className={`flex flex-1 items-center justify-center ${className}`}>
          <div className="text-gray-500">Loading editor...</div>
        </div>
      );
    }

    return (
      <div className={className}>
        <EditorContent editor={editor} placeholder={_placeholder} />
      </div>
    );
  },
);

RichTextEditorContent.displayName = 'RichTextEditorContent';
