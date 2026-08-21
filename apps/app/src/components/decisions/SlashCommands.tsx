'use client';

import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import {
  Suggestion,
  type SuggestionKeyDownProps,
  type SuggestionOptions,
  type SuggestionProps,
} from '@tiptap/suggestion';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
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

import { useTranslations } from '@/lib/i18n';

export interface SlashCommandItem {
  title: string;
  description: string;
  searchTerms: string[];
  icon: React.ComponentType<{ className?: string }>;
  command: ({ editor, range }: { editor: any; range: any }) => void;
}

interface SlashCommandsListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface SlashCommandsListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

const SlashCommandsList = forwardRef<
  SlashCommandsListHandle,
  SlashCommandsListProps
>((props, ref) => {
  const t = useTranslations();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex(
      (selectedIndex + props.items.length - 1) % props.items.length,
    );
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <div
      data-testid="slash-commands-menu"
      className="z-[9999999] h-auto max-h-[330px] w-72 overflow-auto rounded-lg border bg-white p-1 shadow-md"
    >
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            className={`flex w-full items-center space-x-2 rounded-md px-2 py-1 text-start hover:bg-secondary ${
              index === selectedIndex
                ? 'bg-secondary text-foreground'
                : 'text-foreground'
            }`}
            key={index}
            // Keep the caret in the editor: the default mousedown moves focus
            // to the button, which exits the suggestion and unmounts this menu
            // before the click lands, so the item's command never runs.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selectItem(index)}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-white">
              <item.icon className="size-4" />
            </div>
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {item.description}
              </p>
            </div>
          </button>
        ))
      ) : (
        <div className="item">{t('No result')}</div>
      )}
    </div>
  );
});

SlashCommandsList.displayName = 'SlashCommandsList';

const suggestionOptions: Partial<
  SuggestionOptions<SlashCommandItem, SlashCommandItem>
> = {
  items: ({ query }: { query: string }): SlashCommandItem[] => {
    const items: SlashCommandItem[] = [
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

    return items.filter((item) => {
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
    });
  },

  // The menu is rendered through TipTap's ReactRenderer rather than its own
  // `createRoot`. ReactRenderer portals the component into the tree under
  // `EditorContent`, so it keeps the app's React context — a detached root has
  // none, and `useTranslations()` threw there for want of the next-intl
  // provider. The portal only supplies the React tree; the element itself still
  // lives on `document.body` so the menu escapes the editor's overflow.
  render: () => {
    let renderer:
      | ReactRenderer<SlashCommandsListHandle, SlashCommandsListProps>
      | undefined;

    const positionMenu = (
      clientRect: SuggestionProps<SlashCommandItem>['clientRect'],
    ) => {
      const rect = clientRect?.();
      if (!renderer || !rect) {
        return;
      }

      renderer.element.style.top = `${rect.bottom + 8}px`;
      renderer.element.style.left = `${rect.left}px`;
    };

    const destroyMenu = () => {
      // `destroy()` unregisters the portal and removes the element from the DOM.
      renderer?.destroy();
      renderer = undefined;
    };

    return {
      onStart: (props: SuggestionProps<SlashCommandItem>) => {
        if (!props.clientRect) {
          return;
        }

        renderer = new ReactRenderer(SlashCommandsList, {
          editor: props.editor,
          props: { items: props.items, command: props.command },
        });

        renderer.element.style.position = 'absolute';
        renderer.element.style.zIndex = '9999999';
        document.body.appendChild(renderer.element);
        positionMenu(props.clientRect);
      },

      onUpdate(props: SuggestionProps<SlashCommandItem>) {
        renderer?.updateProps({
          items: props.items,
          command: props.command,
        });
        positionMenu(props.clientRect);
      },

      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === 'Escape') {
          destroyMenu();
          return true;
        }

        return renderer?.ref?.onKeyDown(props) ?? false;
      },

      onExit() {
        destroyMenu();
      },
    };
  },
};

export const SlashCommands = Extension.create({
  name: 'slash-commands',

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
