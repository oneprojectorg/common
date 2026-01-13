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

  if (!editor) {
    return null;
  }

  return (
    <div className={`justify-between border-b px-6 py-2 ${className}`}>
      <div className="mx-auto scrollbar-hide flex max-w-fit min-w-0 items-center gap-1 overflow-x-auto">
        {/* Undo/Redo */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="shrink-0 rounded p-2 hover:bg-gray-100 disabled:opacity-50"
          title="Undo"
        >
          <Undo className="size-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="shrink-0 rounded p-2 hover:bg-gray-100 disabled:opacity-50"
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-gray-300" />

        {/* Headings */}
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : ''}`}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''}`}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200' : ''}`}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-gray-300" />

        {/* Text Formatting */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive('bold') ? 'bg-gray-200' : ''}`}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive('italic') ? 'bg-gray-200' : ''}`}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive('underline') ? 'bg-gray-200' : ''}`}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive('strike') ? 'bg-gray-200' : ''}`}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive('code') ? 'bg-gray-200' : ''}`}
          title="Code"
        >
          <Code className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-gray-300" />

        {/* Lists */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive('bulletList') ? 'bg-gray-200' : ''}`}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive('orderedList') ? 'bg-gray-200' : ''}`}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive('blockquote') ? 'bg-gray-200' : ''}`}
          title="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-gray-300" />

        {/* Text Alignment */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200' : ''}`}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200' : ''}`}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200' : ''}`}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px shrink-0 bg-gray-300" />

        {/* Insert Elements */}
        <button
          onClick={addLink}
          className={`shrink-0 rounded p-2 hover:bg-gray-100 ${editor.isActive('link') ? 'bg-gray-200' : ''}`}
          title="Add Link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
        <button
          onClick={addEmbedLink}
          className="shrink-0 rounded p-2 hover:bg-gray-100"
          title="Embed Link Preview"
        >
          <Link2 className="h-4 w-4" />
        </button>
        <button
          onClick={handleImageUpload}
          className="shrink-0 rounded p-2 hover:bg-gray-100"
          title="Add Image"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
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
