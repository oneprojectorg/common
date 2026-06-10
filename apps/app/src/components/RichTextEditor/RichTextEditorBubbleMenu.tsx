'use client';

import { Button } from '@op/sense/Button';
import { Input } from '@op/sense/Input';
import { Separator } from '@op/sense/Separator';
import { Toggle } from '@op/sense/Toggle';
import { NodeSelection } from '@tiptap/pm/state';
import { type Editor, useEditorState } from '@tiptap/react';
import { BubbleMenu, type BubbleMenuProps } from '@tiptap/react/menus';
import { useState } from 'react';
import type { IconType } from 'react-icons';
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

export interface RichTextEditorBubbleMenuProps {
  editor: Editor | null;
  /** Unique key when rendering multiple bubble menus on one page */
  pluginKey?: string;
  /** Override the default visibility logic (non-empty editable text selection) */
  shouldShow?: BubbleMenuProps['shouldShow'];
}

interface MenuItem {
  key: string;
  label: string;
  icon: IconType;
  isActive: boolean;
  toggle: () => void;
}

/**
 * Contextual formatting toolbar that appears above the current text
 * selection, built on TipTap's BubbleMenu (floating-ui positioning,
 * debounced so it doesn't flash while the user is still highlighting).
 */
export function RichTextEditorBubbleMenu({
  editor,
  pluginKey = 'richTextEditorBubbleMenu',
  shouldShow,
}: RichTextEditorBubbleMenuProps) {
  const t = useTranslations();
  const [isEditingLink, setIsEditingLink] = useState(false);

  const activeStates = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            heading1: e.isActive('heading', { level: 1 }),
            heading2: e.isActive('heading', { level: 2 }),
            heading3: e.isActive('heading', { level: 3 }),
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            underline: e.isActive('underline'),
            strike: e.isActive('strike'),
            code: e.isActive('code'),
            bulletList: e.isActive('bulletList'),
            orderedList: e.isActive('orderedList'),
            blockquote: e.isActive('blockquote'),
            alignLeft: e.isActive({ textAlign: 'left' }),
            alignCenter: e.isActive({ textAlign: 'center' }),
            alignRight: e.isActive({ textAlign: 'right' }),
            link: e.isActive('link'),
          }
        : null,
  });

  if (!editor || !activeStates) {
    return null;
  }

  const groups: MenuItem[][] = [
    [
      {
        key: 'heading1',
        label: t('Heading 1'),
        icon: LuHeading1,
        isActive: activeStates.heading1,
        toggle: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        key: 'heading2',
        label: t('Heading 2'),
        icon: LuHeading2,
        isActive: activeStates.heading2,
        toggle: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        key: 'heading3',
        label: t('Heading 3'),
        icon: LuHeading3,
        isActive: activeStates.heading3,
        toggle: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
    ],
    [
      {
        key: 'bold',
        label: t('Bold'),
        icon: LuBold,
        isActive: activeStates.bold,
        toggle: () => editor.chain().focus().toggleBold().run(),
      },
      {
        key: 'italic',
        label: t('Italic'),
        icon: LuItalic,
        isActive: activeStates.italic,
        toggle: () => editor.chain().focus().toggleItalic().run(),
      },
      {
        key: 'underline',
        label: t('Underline'),
        icon: LuUnderline,
        isActive: activeStates.underline,
        toggle: () => editor.chain().focus().toggleUnderline().run(),
      },
      {
        key: 'strike',
        label: t('Strikethrough'),
        icon: LuStrikethrough,
        isActive: activeStates.strike,
        toggle: () => editor.chain().focus().toggleStrike().run(),
      },
      {
        key: 'code',
        label: t('Code'),
        icon: LuCode,
        isActive: activeStates.code,
        toggle: () => editor.chain().focus().toggleCode().run(),
      },
    ],
    [
      {
        key: 'bulletList',
        label: t('Bullet List'),
        icon: LuList,
        isActive: activeStates.bulletList,
        toggle: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        key: 'orderedList',
        label: t('Numbered List'),
        icon: LuListOrdered,
        isActive: activeStates.orderedList,
        toggle: () => editor.chain().focus().toggleOrderedList().run(),
      },
      {
        key: 'blockquote',
        label: t('Blockquote'),
        icon: LuQuote,
        isActive: activeStates.blockquote,
        toggle: () => editor.chain().focus().toggleBlockquote().run(),
      },
    ],
    [
      {
        key: 'alignLeft',
        label: t('Align Left'),
        icon: LuAlignLeft,
        isActive: activeStates.alignLeft,
        toggle: () => editor.chain().focus().setTextAlign('left').run(),
      },
      {
        key: 'alignCenter',
        label: t('Align Center'),
        icon: LuAlignCenter,
        isActive: activeStates.alignCenter,
        toggle: () => editor.chain().focus().setTextAlign('center').run(),
      },
      {
        key: 'alignRight',
        label: t('Align Right'),
        icon: LuAlignRight,
        isActive: activeStates.alignRight,
        toggle: () => editor.chain().focus().setTextAlign('right').run(),
      },
    ],
  ];

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={pluginKey}
      shouldShow={shouldShow ?? defaultShouldShow}
      options={{
        placement: 'top',
        offset: 8,
        flip: true,
        shift: true,
        onHide: () => setIsEditingLink(false),
      }}
      className="z-50 rounded-lg border border-border bg-popover p-1 shadow-md"
    >
      {isEditingLink ? (
        <LinkEditor editor={editor} onClose={() => setIsEditingLink(false)} />
      ) : (
        <div
          className="flex items-center gap-0.5"
          // Keep the editor selection: don't let toolbar clicks move focus
          onMouseDown={(e) => e.preventDefault()}
        >
          {groups.map((group, groupIndex) => (
            <div key={group[0]?.key} className="flex items-center gap-0.5">
              {groupIndex > 0 && (
                <Separator orientation="vertical" className="mx-0.5 h-5" />
              )}
              {group.map((item) => (
                <Toggle
                  key={item.key}
                  size="sm"
                  pressed={item.isActive}
                  onPressedChange={item.toggle}
                  aria-label={item.label}
                  title={item.label}
                >
                  <item.icon className="size-4" />
                </Toggle>
              ))}
            </div>
          ))}
          <Separator orientation="vertical" className="mx-0.5 h-5" />
          <Toggle
            size="sm"
            pressed={activeStates.link}
            onPressedChange={() => setIsEditingLink(true)}
            aria-label={t('Add Link')}
            title={t('Add Link')}
          >
            <LuLink className="size-4" />
          </Toggle>
        </div>
      )}
    </BubbleMenu>
  );
}

const defaultShouldShow: NonNullable<BubbleMenuProps['shouldShow']> = ({
  editor,
  state,
}) => {
  const { selection } = state;

  if (selection.empty || !editor.isEditable) {
    return false;
  }

  // Node selections (images, rules, …) and code blocks get no text formatting
  if (selection instanceof NodeSelection) {
    return false;
  }

  if (editor.isActive('codeBlock')) {
    return false;
  }

  return true;
};

/**
 * Inline link form rendered inside the bubble menu element. Kept inline
 * (rather than a portaled popover) so focusing the input doesn't count as
 * leaving the menu, which would hide it.
 */
function LinkEditor({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const t = useTranslations();
  const existingHref: unknown = editor.getAttributes('link').href;
  const [url, setUrl] = useState(
    typeof existingHref === 'string' ? existingHref : '',
  );

  const applyLink = () => {
    const href = url.trim();

    if (href === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }

    onClose();
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  };

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        applyLink();
      }}
    >
      <Input
        autoFocus
        type="text"
        inputMode="url"
        placeholder={t('URL')}
        aria-label={t('URL')}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            editor.commands.focus();
          }
        }}
        className="h-8 w-56"
      />
      <Button type="submit" size="sm" variant="secondary">
        {t('Save')}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={removeLink}>
        {t('Remove')}
      </Button>
    </form>
  );
}
