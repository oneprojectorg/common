'use client';

import { zodUrlRefine } from '@op/common/validation';
import { Button } from '@op/sense/Button';
import { Input } from '@op/sense/Input';
import { Popover, PopoverTrigger, PopoverContent } from '@op/sense/Popover';
import { Separator } from '@op/sense/Separator';
import { Toggle } from '@op/sense/Toggle';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { type Editor, useEditorState } from '@tiptap/react';
import { BubbleMenu, type BubbleMenuProps } from '@tiptap/react/menus';
import React, { useEffect, useMemo, useState } from 'react';
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
  LuHeading4,
  LuItalic,
  LuLink,
  LuLink2,
  LuList,
  LuChevronRight,
  LuListOrdered,
  LuQuote,
  LuSave,
  LuStrikethrough,
  LuUnderline,
  LuX,
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
  const [isEditingEmbed, setIsEditingEmbed] = useState(false);

  // Focusing the URL input blurs the editor, which hides the native
  // selection highlight — so while the link editor is open, an inline
  // decoration repaints the selection to keep the target text visible.
  const highlightKey = useMemo(
    () => new PluginKey<DecorationSet>(`${pluginKey}LinkHighlight`),
    [pluginKey],
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }
    editor.registerPlugin(createLinkHighlightPlugin(highlightKey));
    return () => {
      if (!editor.isDestroyed) {
        editor.unregisterPlugin(highlightKey);
      }
    };
  }, [editor, highlightKey]);

  const activeStates = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            heading1: e.isActive('heading', { level: 1 }),
            heading2: e.isActive('heading', { level: 2 }),
            heading3: e.isActive('heading', { level: 3 }),
            heading4: e.isActive('heading', { level: 4 }),
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            underline: e.isActive('underline'),
            strike: e.isActive('strike'),
            code: e.isActive('code'),
            bulletList: e.isActive('bulletList'),
            orderedList: e.isActive('orderedList'),
            blockquote: e.isActive('blockquote'),
            details: e.isActive('details'),
            link: e.isActive('link'),
            alignLeft: e.isActive({ textAlign: 'left' }),
            alignCenter: e.isActive({ textAlign: 'center' }),
            alignRight: e.isActive({ textAlign: 'right' }),
          }
        : null,
  });

  if (!editor || !activeStates) {
    return null;
  }

  // The bubble menu is shared; only offer the embed button where the editor
  // actually registered the Iframely extension (so `setIframely` exists).
  const hasEmbed = editor.extensionManager.extensions.some(
    (extension) => extension.name === 'iframely',
  );

  const openLinkEditor = () => {
    const { from, to } = editor.state.selection;
    editor.view.dispatch(editor.state.tr.setMeta(highlightKey, { from, to }));
    setIsEditingLink(true);
  };

  const closeLinkEditor = () => {
    if (!editor.isDestroyed) {
      editor.view.dispatch(editor.state.tr.setMeta(highlightKey, 'clear'));
    }
    setIsEditingLink(false);
  };

  const groups: MenuItem[][] = [
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
    ],
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
      {
        key: 'heading4',
        label: t('Heading 4'),
        icon: LuHeading4,
        isActive: activeStates.heading4,
        toggle: () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
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
      {
        key: 'code',
        label: t('Code'),
        icon: LuCode,
        isActive: activeStates.code,
        toggle: () => editor.chain().focus().toggleCode().run(),
      },
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
      {
        key: 'details',
        label: t('Collapsible'),
        icon: LuChevronRight,
        isActive: activeStates.details,
        // The Details extension has no toggleDetails — branch on active state
        toggle: () => {
          if (activeStates.details) {
            editor.chain().focus().unsetDetails().run();
            return;
          }

          editor.chain().focus().setDetails().run();

          // Details is `isolating` with no gap cursor, so a details at the end
          // of the doc traps the caret. Insert a trailing paragraph right after
          // it (when nothing follows) so the user can type below it.
          const { state } = editor;
          const { $from } = state.selection;
          for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name === 'details') {
              const after = $from.after(depth);
              if (!state.doc.nodeAt(after)) {
                editor
                  .chain()
                  .insertContentAt(after, { type: 'paragraph' })
                  .run();
              }

              break;
            }
          }
        },
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
        onHide: () => {
          closeLinkEditor();
          setIsEditingEmbed(false);
        },
      }}
      className="z-50 rounded-lg border border-border bg-popover p-2 shadow-md"
    >
      {/* The toolbar stays mounted while the link editor is open so the
          menu keeps its size and anchor instead of jumping */}
      <div className="flex flex-col gap-2">
        <div
          className="flex flex-col gap-2"
          // Keep the editor selection: don't let toolbar clicks move focus
          onMouseDown={(e) => e.preventDefault()}
        >
          {groups.map((group) => (
            <React.Fragment key={group[0]?.key}>
              <div className="grid grid-cols-2 gap-2">
                {group.map((item) => (
                  <Toggle
                    key={item.key}
                    size="sm"
                    pressed={item.isActive}
                    onPressedChange={item.toggle}
                    aria-label={item.label}
                    title={item.label}
                    className="size-8 aria-pressed:bg-primary aria-pressed:text-white"
                  >
                    <item.icon className="size-4" />
                  </Toggle>
                ))}
              </div>
              <Separator orientation="horizontal" className="w-full" />
            </React.Fragment>
          ))}
          <div className="grid grid-cols-2 gap-2">
            {/* Controlled by isEditingLink so every dismissal path (outside
                click, escape, trigger toggle) also clears the selection
                highlight decoration */}
            <Popover
              open={isEditingLink}
              onOpenChange={(open, eventDetails) => {
                if (open) {
                  openLinkEditor();
                  return;
                }
                closeLinkEditor();
                // Refocus the editor so the native selection highlight takes
                // over from the cleared decoration — unless the user
                // deliberately moved focus elsewhere
                if (
                  eventDetails.reason !== 'outside-press' &&
                  eventDetails.reason !== 'focus-out'
                ) {
                  editor.commands.focus();
                }
              }}
            >
              <PopoverTrigger
                render={
                  <Toggle
                    size="sm"
                    pressed={isEditingLink || activeStates.link}
                    aria-label={t('Add Link')}
                    title={t('Add Link')}
                    className="h-8 aria-pressed:bg-primary aria-pressed:text-white"
                  >
                    <LuLink className="size-4" />
                  </Toggle>
                }
              />
              <PopoverContent align="center" side="top">
                <LinkEditor editor={editor} onClose={closeLinkEditor} />
              </PopoverContent>
            </Popover>
            {/* Embed (Iframely) — paste/enter a URL to insert a link preview.
                Same icon as the proposal toolbar's embed button. */}
            {hasEmbed && (
              <Popover
                open={isEditingEmbed}
                onOpenChange={(open, eventDetails) => {
                  setIsEditingEmbed(open);
                  if (
                    !open &&
                    eventDetails.reason !== 'outside-press' &&
                    eventDetails.reason !== 'focus-out'
                  ) {
                    editor.commands.focus();
                  }
                }}
              >
                <PopoverTrigger
                  render={
                    <Toggle
                      size="sm"
                      pressed={isEditingEmbed}
                      aria-label={t('Embed Link Preview')}
                      title={t('Embed Link Preview')}
                      className="h-8 aria-pressed:bg-primary aria-pressed:text-white"
                    >
                      <LuLink2 className="size-4" />
                    </Toggle>
                  }
                />
                <PopoverContent align="center" side="top">
                  <EmbedEditor
                    editor={editor}
                    onClose={() => setIsEditingEmbed(false)}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>
    </BubbleMenu>
  );
}

/**
 * Repaints the saved selection range while the link editor holds focus.
 * Set via transaction meta: `{ from, to }` to highlight, `'clear'` to remove.
 */
function createLinkHighlightPlugin(key: PluginKey<DecorationSet>) {
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: () => DecorationSet.empty,
      apply: (tr, decorations) => {
        const meta: unknown = tr.getMeta(key);
        if (meta === 'clear') {
          return DecorationSet.empty;
        }
        if (
          typeof meta === 'object' &&
          meta !== null &&
          'from' in meta &&
          'to' in meta &&
          typeof meta.from === 'number' &&
          typeof meta.to === 'number'
        ) {
          return DecorationSet.create(tr.doc, [
            // Matches the global ::selection color. Vertical padding extends
            // the background to line-box height like native selection —
            // inline vertical padding paints without affecting line layout.
            Decoration.inline(meta.from, meta.to, {
              class: 'bg-primary-100 py-0.5',
            }),
          ]);
        }
        return decorations.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return key.getState(state);
      },
    },
  });
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
  const [isInvalid, setIsInvalid] = useState(false);

  const applyLink = () => {
    const raw = url.trim();

    if (raw === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      onClose();
      return;
    }

    // Match the app-wide URL field convention (zodUrl): prefix https://
    // when no protocol is given, validate the format before saving
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (!zodUrlRefine(href)) {
      setIsInvalid(true);
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    onClose();
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  };

  return (
    <form
      className="flex flex-col gap-2"
      // The popover is portaled, but React synthetic events still bubble through
      // the React tree to the toolbar's `onMouseDown` preventDefault — which would
      // cancel text selection/caret placement in this input. Stop it here.
      onMouseDown={(e) => e.stopPropagation()}
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
        aria-invalid={isInvalid || undefined}
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setIsInvalid(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            editor.commands.focus();
          }
        }}
        className="h-8 w-full"
      />
      {isInvalid && (
        <p className="text-sm text-destructive">{t('Enter a valid URL')}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="outline" className="flex-1">
          <LuSave />
          {t('Save')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={removeLink}
        >
          <LuX />
          {t('Remove')}
        </Button>
      </div>
    </form>
  );
}

/**
 * Inline embed form: enter a URL and insert an Iframely link-preview node.
 * Mirrors {@link LinkEditor}; no selection-highlight decoration since the embed
 * inserts a block node rather than wrapping the selected text.
 */
function EmbedEditor({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [url, setUrl] = useState('');
  const [isInvalid, setIsInvalid] = useState(false);

  const applyEmbed = () => {
    const raw = url.trim();

    if (raw === '') {
      onClose();
      return;
    }

    // Same URL convention as the link editor: prefix https:// when no protocol
    // is given, validate the format before inserting.
    const src = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (!zodUrlRefine(src)) {
      setIsInvalid(true);
      return;
    }

    editor.chain().focus().setIframely({ src }).run();
    onClose();
  };

  return (
    <form
      className="flex flex-col gap-2"
      // Portaled, but synthetic mousedown still bubbles to the toolbar's
      // preventDefault (see LinkEditor) — stop it so the input is selectable.
      onMouseDown={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        applyEmbed();
      }}
    >
      <Input
        autoFocus
        type="text"
        inputMode="url"
        placeholder={t('URL')}
        aria-label={t('URL')}
        aria-invalid={isInvalid || undefined}
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setIsInvalid(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            editor.commands.focus();
          }
        }}
        className="h-8 w-full"
      />
      {isInvalid && (
        <p className="text-sm text-destructive">{t('Enter a valid URL')}</p>
      )}
      <Button type="submit" size="sm" variant="outline" className="w-full">
        <LuLink2 />
        {t('Embed Link Preview')}
      </Button>
    </form>
  );
}
