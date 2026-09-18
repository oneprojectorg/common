'use client';

import { useFileUpload } from '@/hooks/useFileUpload';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import { Separator } from '@op/sense/Separator';
import { Toggle } from '@op/sense/Toggle';
import { ToggleGroup, ToggleGroupItem } from '@op/sense/ToggleGroup';
import { cn } from '@op/sense/lib/utils';
import type { Editor } from '@tiptap/react';
import type { ReactNode } from 'react';
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
        logger.error('Failed to upload image', {
          error,
          context: 'RichTextEditorToolbar.uploadImage',
        });
      }

      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [editor, uploadFile],
  );

  const noEditor = !editor;

  const divider = (
    <Separator orientation="vertical" className="mx-2 h-6 shrink-0" />
  );

  // --- Derived active state (the editor is the source of truth). Every group
  // is a base-ui multi-toggle group; each option carries the command to run
  // when its membership flips (see runChanged). ---
  const headingOptions = [
    {
      value: '1',
      label: t('editor.headingLevelAction', { level: 1 }),
      Icon: LuHeading1,
      run: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      value: '2',
      label: t('editor.headingLevelAction', { level: 2 }),
      Icon: LuHeading2,
      run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      value: '3',
      label: t('editor.headingLevelAction', { level: 3 }),
      Icon: LuHeading3,
      run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
    },
  ];
  const activeHeadings = headingOptions
    .filter((h) => editor?.isActive('heading', { level: Number(h.value) }))
    .map((h) => h.value);

  const alignOptions = [
    {
      value: 'left',
      label: t('editor.alignLeftAction'),
      Icon: LuAlignLeft,
      run: () => editor?.chain().focus().setTextAlign('left').run(),
    },
    {
      value: 'center',
      label: t('editor.alignCenterAction'),
      Icon: LuAlignCenter,
      run: () => editor?.chain().focus().setTextAlign('center').run(),
    },
    {
      value: 'right',
      label: t('editor.alignRightAction'),
      Icon: LuAlignRight,
      run: () => editor?.chain().focus().setTextAlign('right').run(),
    },
  ];
  const activeAligns = alignOptions
    .filter((a) => editor?.isActive({ textAlign: a.value }))
    .map((a) => a.value);

  const markOptions = [
    {
      value: 'bold',
      label: t('editor.boldAction'),
      Icon: LuBold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      value: 'italic',
      label: t('editor.italicAction'),
      Icon: LuItalic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      value: 'underline',
      label: t('editor.underlineAction'),
      Icon: LuUnderline,
      run: () => editor?.chain().focus().toggleUnderline().run(),
    },
    {
      value: 'strike',
      label: t('editor.strikethroughAction'),
      Icon: LuStrikethrough,
      run: () => editor?.chain().focus().toggleStrike().run(),
    },
    {
      value: 'code',
      label: t('editor.inlineCodeLabel'),
      Icon: LuCode,
      run: () => editor?.chain().focus().toggleCode().run(),
    },
  ];
  const activeMarks = markOptions
    .filter((m) => editor?.isActive(m.value))
    .map((m) => m.value);

  const listOptions = [
    {
      value: 'bulletList',
      label: t('editor.bulletListAction'),
      Icon: LuList,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      value: 'orderedList',
      label: t('editor.numberedListAction'),
      Icon: LuListOrdered,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      value: 'blockquote',
      label: t('editor.blockquoteAction'),
      Icon: LuQuote,
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
  ];
  const activeLists = listOptions
    .filter((l) => editor?.isActive(l.value))
    .map((l) => l.value);

  // Multiple-select groups: exactly one item flips per interaction, so run the
  // command for the value whose membership changed between prev and next.
  const runChanged = (
    opts: { value: string; run: () => void }[],
    active: string[],
    next: string[],
  ) => {
    opts
      .find((o) => next.includes(o.value) !== active.includes(o.value))
      ?.run();
  };

  return (
    <div className={cn('border-b px-6 py-2', className)}>
      <div
        role="toolbar"
        aria-label={t('editor.toolbarLabel')}
        aria-orientation="horizontal"
        // overflow-x-auto also clips overflow-y (cutting off each control's
        // focus ring); p-1 + scroll-p-1 give the ring-3 room to paint.
        className="mx-auto scrollbar-hide flex max-w-fit min-w-0 scroll-p-1 items-center gap-1 overflow-x-auto p-1"
      >
        {/* Undo/Redo */}
        <ActionButton
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={noEditor || !editor.can().undo()}
          noEditor={noEditor}
          label={t('editor.undoAction')}
        >
          <LuUndo className="size-4 rtl:-scale-x-100" />
        </ActionButton>
        <ActionButton
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={noEditor || !editor.can().redo()}
          noEditor={noEditor}
          label={t('editor.redoAction')}
        >
          <LuRedo className="size-4 rtl:-scale-x-100" />
        </ActionButton>

        {divider}

        {/* Headings — one heading level at a time (a block is 0 or 1 level) */}
        <ToggleGroup
          size="icon-sm"
          spacing={1}
          disabled={noEditor}
          aria-label={t('editor.headingsGroupLabel')}
          value={activeHeadings}
          onValueChange={(next: string[]) =>
            runChanged(headingOptions, activeHeadings, next)
          }
        >
          {headingOptions.map(({ value, label, Icon }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              aria-label={label}
              title={label}
            >
              <Icon className="size-4" />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {divider}

        {/* Text formatting */}
        <ToggleGroup
          size="icon-sm"
          spacing={1}
          disabled={noEditor}
          aria-label={t('editor.textFormattingGroupLabel')}
          value={activeMarks}
          onValueChange={(next: string[]) =>
            runChanged(markOptions, activeMarks, next)
          }
        >
          {markOptions.map(({ value, label, Icon }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              aria-label={label}
              title={label}
            >
              <Icon className="size-4" />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {divider}

        {/* Lists */}
        <ToggleGroup
          size="icon-sm"
          spacing={1}
          disabled={noEditor}
          aria-label={t('editor.listsGroupLabel')}
          value={activeLists}
          onValueChange={(next: string[]) =>
            runChanged(listOptions, activeLists, next)
          }
        >
          {listOptions.map(({ value, label, Icon }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              aria-label={label}
              title={label}
            >
              <Icon className="size-4" />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {divider}

        {/* Text alignment — one alignment at a time */}
        <ToggleGroup
          size="icon-sm"
          spacing={1}
          disabled={noEditor}
          aria-label={t('editor.textAlignmentGroupLabel')}
          value={activeAligns}
          onValueChange={(next: string[]) =>
            runChanged(alignOptions, activeAligns, next)
          }
        >
          {alignOptions.map(({ value, label, Icon }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              aria-label={label}
              title={label}
            >
              <Icon className="size-4" />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {divider}

        {/* Insert elements */}
        <ToggleButton
          active={editor?.isActive('link') ?? false}
          onToggle={addLink}
          noEditor={noEditor}
          label={t('editor.addLinkAction')}
        >
          <LuLink className="size-4" />
        </ToggleButton>
        <ActionButton
          onClick={addEmbedLink}
          noEditor={noEditor}
          label={t('editor.embedLinkPreviewAction')}
        >
          <LuLink2 className="size-4" />
        </ActionButton>
        <ActionButton
          onClick={handleImageUpload}
          noEditor={noEditor}
          label={t('editor.addImageAction')}
        >
          <LuImage className="size-4" />
        </ActionButton>
        <ActionButton
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          noEditor={noEditor}
          label={t('editor.addHorizontalRuleAction')}
        >
          <LuMinus className="size-4" />
        </ActionButton>
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

// Toolbar toggle: pressed reflects the editor's active state; onToggle runs the
// command (the editor is the source of truth, so this is controlled). Defined at
// module level so its identity is stable across the toolbar's frequent
// re-renders — otherwise a new component type each render would remount the
// button and drop focus mid-interaction.
function ToggleButton({
  active,
  onToggle,
  label,
  disabled,
  noEditor,
  children,
}: {
  active: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
  noEditor: boolean;
  children: ReactNode;
}) {
  return (
    <Toggle
      size="icon-sm"
      pressed={active}
      onPressedChange={onToggle}
      disabled={disabled ?? noEditor}
      aria-label={label}
      title={label}
      className="shrink-0"
    >
      {children}
    </Toggle>
  );
}

// Toolbar action (no pressed state): undo/redo, embeds, image, rule.
function ActionButton({
  onClick,
  label,
  disabled,
  noEditor,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  noEditor: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      disabled={disabled ?? noEditor}
      aria-label={label}
      title={label}
      className="shrink-0"
    >
      {children}
    </Button>
  );
}
