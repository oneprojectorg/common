'use client';

import { useFileUpload } from '@/hooks/useFileUpload';
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
  Image as ImageIcon,
  Italic,
  Link2,
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
import { useCallback, useRef } from 'react';

export interface RichTextEditorToolbarProps {
  editor: Editor | null;
  className?: string;
}

export function RichTextEditorToolbar({
  editor,
  className = '',
}: RichTextEditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload setup for images only
  const { uploadFile } = useFileUpload({
    acceptedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    maxFiles: 10,
    maxSizePerFile: 4 * 1024 * 1024, // 4MB
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
  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor?.isActive(name, attrs) ?? false;

  const btnClass = (active: boolean) =>
    `shrink-0 rounded p-2 hover:bg-gray-100 ${active ? 'bg-gray-200' : ''}`;

  return (
    <div className={`justify-between border-b px-6 py-2 ${className}`}>
      <div className="mx-auto scrollbar-hide flex max-w-fit min-w-0 items-center gap-1 overflow-x-auto">
        {/* Undo/Redo */}
        <button
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={noEditor || !editor.can().undo()}
          className="shrink-0 rounded p-2 hover:bg-gray-100"
          title="Undo"
        >
          <Undo className="size-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={noEditor || !editor.can().redo()}
          className="shrink-0 rounded p-2 hover:bg-gray-100"
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-gray-300" />

        {/* Headings */}
        <button
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 1 }).run()
          }
          disabled={noEditor}
          className={btnClass(isActive('heading', { level: 1 }))}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
          disabled={noEditor}
          className={btnClass(isActive('heading', { level: 2 }))}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
          disabled={noEditor}
          className={btnClass(isActive('heading', { level: 3 }))}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-gray-300" />

        {/* Text Formatting */}
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={noEditor}
          className={btnClass(isActive('bold'))}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={noEditor}
          className={btnClass(isActive('italic'))}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          disabled={noEditor}
          className={btnClass(isActive('underline'))}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          disabled={noEditor}
          className={btnClass(isActive('strike'))}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleCode().run()}
          disabled={noEditor}
          className={btnClass(isActive('code'))}
          title="Code"
        >
          <Code className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-gray-300" />

        {/* Lists */}
        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          disabled={noEditor}
          className={btnClass(isActive('bulletList'))}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          disabled={noEditor}
          className={btnClass(isActive('orderedList'))}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          disabled={noEditor}
          className={btnClass(isActive('blockquote'))}
          title="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-gray-300" />

        {/* Text Alignment */}
        <button
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          disabled={noEditor}
          className={btnClass(isActive('textAlign', { textAlign: 'left' }))}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          disabled={noEditor}
          className={btnClass(isActive('textAlign', { textAlign: 'center' }))}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          disabled={noEditor}
          className={btnClass(isActive('textAlign', { textAlign: 'right' }))}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-gray-300" />

        {/* Insert Elements */}
        <button
          onClick={addLink}
          disabled={noEditor}
          className={btnClass(isActive('link'))}
          title="Add Link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
        <button
          onClick={addEmbedLink}
          disabled={noEditor}
          className="shrink-0 rounded p-2 hover:bg-gray-100"
          title="Embed Link Preview"
        >
          <Link2 className="h-4 w-4" />
        </button>
        <button
          onClick={handleImageUpload}
          disabled={noEditor}
          className="shrink-0 rounded p-2 hover:bg-gray-100"
          title="Add Image"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          disabled={noEditor}
          className="shrink-0 rounded p-2 hover:bg-gray-100"
          title="Add Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
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
