'use client';

import { useFileUpload } from '@/hooks/useFileUpload';
import { cn } from '@op/ui/utils';
import type { Editor } from '@tiptap/react';
import { useCallback, useRef } from 'react';
import {
  LuAlignCenter,
  LuAlignLeft,
  LuAlignRight,
  LuBold,
  LuCode,
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuImage,
  LuItalic,
  LuLink,
  LuLink2,
  LuList,
  LuListOrdered,
  LuMinus,
  LuQuote,
  LuRedo,
  LuStrikethrough,
  LuUnderline,
  LuUndo,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export interface RichTextEditorToolbarProps {
  editor: Editor | null;
  className?: string;
}

export function RichTextEditorToolbar({
  editor,
  className = '',
}: RichTextEditorToolbarProps) {
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload setup for images only
  const { uploadFile } = useFileUpload({
    acceptedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    maxFiles: 10,
    maxSizePerFile: 25 * 1024 * 1024, // 25MB
  });

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

  const addEmbedLink = useCallback(() => {
    const url = window.prompt('Enter the URL to embed:');

    if (url && url.trim()) {
      editor?.chain().focus().setIframely({ src: url.trim() }).run();
    }
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

  const noEditor = !editor;

  const btnClass = (active: boolean) =>
    `shrink-0 rounded p-2 hover:bg-muted ${active ? 'bg-accent text-foreground' : ''}`;

  /** Spreadable props for a toolbar toggle: includes aria-pressed for tests. */
  const btnProps = (active: boolean) => ({
    'aria-pressed': active,
    className: btnClass(active),
  });

  return (
    <div
      className={cn(
        'justify-between border-b px-6 py-2 text-foreground',
        className,
      )}
    >
      <div className="mx-auto scrollbar-hide flex max-w-fit min-w-0 items-center gap-1 overflow-x-auto">
        {/* Undo/Redo */}
        <button
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={noEditor || !editor.can().undo()}
          className="shrink-0 rounded p-2 hover:bg-muted"
          title={t('Undo')}
        >
          <LuUndo className="size-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={noEditor || !editor.can().redo()}
          className="shrink-0 rounded p-2 hover:bg-muted"
          title={t('Redo')}
        >
          <LuRedo className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-border" />

        {/* Headings */}
        <button
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 1 }).run()
          }
          disabled={noEditor}
          {...btnProps(
            editor?.isActive('heading', { level: 1 }) ?? false,
          )}
          title={t('Heading 1')}
        >
          <LuHeading1 className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
          disabled={noEditor}
          {...btnProps(
            editor?.isActive('heading', { level: 2 }) ?? false,
          )}
          title={t('Heading 2')}
        >
          <LuHeading2 className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
          disabled={noEditor}
          {...btnProps(
            editor?.isActive('heading', { level: 3 }) ?? false,
          )}
          title={t('Heading 3')}
        >
          <LuHeading3 className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-border" />

        {/* Text Formatting */}
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={noEditor}
          {...btnProps(editor?.isActive('bold') ?? false)}
          title={t('Bold')}
        >
          <LuBold className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={noEditor}
          {...btnProps(editor?.isActive('italic') ?? false)}
          title={t('Italic')}
        >
          <LuItalic className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          disabled={noEditor}
          {...btnProps(editor?.isActive('underline') ?? false)}
          title={t('Underline')}
        >
          <LuUnderline className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          disabled={noEditor}
          {...btnProps(editor?.isActive('strike') ?? false)}
          title={t('Strikethrough')}
        >
          <LuStrikethrough className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleCode().run()}
          disabled={noEditor}
          {...btnProps(editor?.isActive('code') ?? false)}
          title={t('Code')}
        >
          <LuCode className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-border" />

        {/* Lists */}
        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          disabled={noEditor}
          {...btnProps(editor?.isActive('bulletList') ?? false)}
          title={t('Bullet List')}
        >
          <LuList className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          disabled={noEditor}
          {...btnProps(editor?.isActive('orderedList') ?? false)}
          title={t('Numbered List')}
        >
          <LuListOrdered className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          disabled={noEditor}
          {...btnProps(editor?.isActive('blockquote') ?? false)}
          title={t('Blockquote')}
        >
          <LuQuote className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-border" />

        {/* Text Alignment */}
        <button
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          disabled={noEditor}
          {...btnProps(editor?.isActive({ textAlign: 'left' }) ?? false)}
          title={t('Align Left')}
        >
          <LuAlignLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          disabled={noEditor}
          {...btnProps(
            editor?.isActive({ textAlign: 'center' }) ?? false,
          )}
          title={t('Align Center')}
        >
          <LuAlignCenter className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          disabled={noEditor}
          {...btnProps(
            editor?.isActive({ textAlign: 'right' }) ?? false,
          )}
          title={t('Align Right')}
        >
          <LuAlignRight className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-border" />

        {/* Insert Elements */}
        <button
          onClick={addLink}
          disabled={noEditor}
          {...btnProps(editor?.isActive('link') ?? false)}
          title={t('Add Link')}
        >
          <LuLink className="h-4 w-4" />
        </button>
        <button
          onClick={addEmbedLink}
          disabled={noEditor}
          className="shrink-0 rounded p-2 hover:bg-muted"
          title={t('Embed Link Preview')}
        >
          <LuLink2 className="h-4 w-4" />
        </button>
        <button
          onClick={handleImageUpload}
          disabled={noEditor}
          className="shrink-0 rounded p-2 hover:bg-muted"
          title={t('Add Image')}
        >
          <LuImage className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          disabled={noEditor}
          className="shrink-0 rounded p-2 hover:bg-muted"
          title={t('Add Horizontal Rule')}
        >
          <LuMinus className="h-4 w-4" />
        </button>
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
