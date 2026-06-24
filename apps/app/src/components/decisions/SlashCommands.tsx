'use client';

import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion, SuggestionOptions } from '@tiptap/suggestion';
import {
  LuCode,
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuLink2,
  LuList,
  LuListOrdered,
  LuMinus,
  LuQuote,
  LuType,
} from 'react-icons/lu';

import {
  createSlashMenuController,
  getSlashMenuController,
  type SlashCommandItem,
  type SlashMenuController,
} from '@/components/RichTextEditor/slashMenuController';

// Query-independent: built once at module load, not rebuilt on every keystroke.
const SLASH_ITEMS: SlashCommandItem[] = [
  {
    title: 'Text',
    description: 'Just start typing with plain text.',
    searchTerms: ['p', 'paragraph'],
    icon: LuType,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode('paragraph', 'paragraph')
        .run();
    },
  },
  {
    title: 'Heading 1',
    description: 'Big section heading.',
    searchTerms: ['title', 'big', 'large'],
    icon: LuHeading1,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 1 })
        .run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading.',
    searchTerms: ['subtitle', 'medium'],
    icon: LuHeading2,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 2 })
        .run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading.',
    searchTerms: ['subtitle', 'small'],
    icon: LuHeading3,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 3 })
        .run();
    },
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list.',
    searchTerms: ['unordered', 'point'],
    icon: LuList,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    description: 'Create a list with numbering.',
    searchTerms: ['ordered'],
    icon: LuListOrdered,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Quote',
    description: 'Capture a quote.',
    searchTerms: ['blockquote'],
    icon: LuQuote,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode('paragraph', 'paragraph')
        .toggleBlockquote()
        .run();
    },
  },
  {
    title: 'Code',
    description: 'Capture a code snippet.',
    searchTerms: ['codeblock'],
    icon: LuCode,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Divider',
    description: 'Visually divide blocks.',
    searchTerms: ['horizontal', 'rule', 'hr'],
    icon: LuMinus,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Link Embed',
    description: 'Embed a link with preview.',
    searchTerms: ['embed', 'preview', 'iframely', 'url'],
    icon: LuLink2,
    command: ({ editor, range }) => {
      const url = window.prompt('Enter the URL to embed:');
      if (url && url.trim()) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setIframely({ src: url.trim() })
          .run();
      }
    },
  },
];

const suggestionOptions: Partial<SuggestionOptions> = {
  items: ({ query }: { query: string }): SlashCommandItem[] =>
    SLASH_ITEMS.filter((item) => {
      if (typeof query === 'string' && query.length > 0) {
        const search = query.toLowerCase();
        return (
          item.title.toLowerCase().includes(search) ||
          item.description.toLowerCase().includes(search) ||
          (item.searchTerms &&
            item.searchTerms.some((term: string) => term.includes(search)))
        );
      }
      return true;
    }),

  // Render only writes to the per-editor controller; `SlashCommandMenu` (mounted
  // in the React tree alongside the editor) subscribes and renders the menu.
  // The controller is captured in `onStart` because `onKeyDown` props carry only
  // `{ view, event, range }` — no `editor` to look it up from.
  render: () => {
    let controller: SlashMenuController | undefined;

    return {
      onStart: (props: any) => {
        controller = getSlashMenuController(props.editor);
        controller?.update({
          open: true,
          items: props.items,
          command: props.command,
          clientRect: props.clientRect ?? null,
        });
      },

      onUpdate: (props: any) => {
        controller?.update({
          items: props.items,
          command: props.command,
          clientRect: props.clientRect ?? null,
        });
      },

      // Delegate to the menu's key handler. Escape isn't handled there (returns
      // false), so the suggestion plugin runs its own exit → `onExit` closes.
      onKeyDown: (props: any) =>
        controller?.handleKeyDown(props.event) ?? false,

      onExit: () => {
        controller?.update({ open: false });
        controller = undefined;
      },
    };
  },
};

export const SlashCommands = Extension.create({
  name: 'slash-commands',

  addStorage(): { controller: SlashMenuController } {
    return { controller: createSlashMenuController() };
  },

  addOptions() {
    return {
      suggestion: {
        char: '/',
        pluginKey: new PluginKey('slash-commands'),
        command: ({
          editor,
          range,
          props,
        }: {
          editor: any;
          range: any;
          props: SlashCommandItem;
        }) => {
          props.command({ editor, range });
        },
        ...suggestionOptions,
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
