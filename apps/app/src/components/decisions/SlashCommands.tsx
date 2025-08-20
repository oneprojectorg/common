import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion, SuggestionOptions } from '@tiptap/suggestion';
import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Quote,
  Type,
} from 'lucide-react';
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { createRoot } from 'react-dom/client';

export interface SlashCommandItem {
  title: string;
  description: string;
  searchTerms: string[];
  icon: React.ComponentType<{ className?: string }>;
  command: ({ editor, range }: { editor: any; range: any }) => void;
}

const SlashCommandsList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  {
    items: SlashCommandItem[];
    command: (item: SlashCommandItem) => void;
  }
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
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
    <div className="z-50 h-auto max-h-[330px] w-72 overflow-auto rounded-md border border-neutral-gray1 bg-white p-1 shadow-md">
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            className={`flex w-full items-center space-x-2 rounded-sm px-2 py-1 text-left hover:bg-neutral-gray1 ${
              index === selectedIndex ? 'bg-neutral-gray1 text-neutral-black' : 'text-neutral-charcoal'
            }`}
            key={index}
            onClick={() => selectItem(index)}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-neutral-gray1 bg-white">
              <item.icon className="size-4" />
            </div>
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-neutral-gray2">{item.description}</p>
            </div>
          </button>
        ))
      ) : (
        <div className="item">No result</div>
      )}
    </div>
  );
});

SlashCommandsList.displayName = 'SlashCommandsList';

const suggestionOptions: Partial<SuggestionOptions> = {
  items: ({ query }: { query: string }): SlashCommandItem[] => {
    const items: SlashCommandItem[] = [
      {
        title: 'Text',
        description: 'Just start typing with plain text.',
        searchTerms: ['p', 'paragraph'],
        icon: Type,
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
        icon: Heading1,
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
        icon: Heading2,
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
        icon: Heading3,
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
        icon: List,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
      {
        title: 'Numbered List',
        description: 'Create a list with numbering.',
        searchTerms: ['ordered'],
        icon: ListOrdered,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
      },
      {
        title: 'Quote',
        description: 'Capture a quote.',
        searchTerms: ['blockquote'],
        icon: Quote,
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
        icon: Code,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
      },
      {
        title: 'Divider',
        description: 'Visually divide blocks.',
        searchTerms: ['horizontal', 'rule', 'hr'],
        icon: Minus,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHorizontalRule().run();
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

  render: () => {
    let component: any;
    let popup: any;
    let root: any;

    return {
      onStart: (props: any) => {
        if (!props.clientRect) {
          return;
        }

        popup = document.createElement('div');
        popup.style.position = 'absolute';
        popup.style.top = `${props.clientRect().bottom + 8}px`;
        popup.style.left = `${props.clientRect().left}px`;
        popup.style.zIndex = '50';
        document.body.appendChild(popup);

        root = createRoot(popup);
        root.render(
          <SlashCommandsList
            ref={(ref) => {
              component = ref;
            }}
            items={props.items}
            command={props.command}
          />
        );
      },

      onUpdate(props: any) {
        if (!popup || !root) return;

        if (props.clientRect) {
          popup.style.top = `${props.clientRect().bottom + 8}px`;
          popup.style.left = `${props.clientRect().left}px`;
        }

        root.render(
          <SlashCommandsList
            ref={(ref) => {
              component = ref;
            }}
            items={props.items}
            command={props.command}
          />
        );
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          if (root) {
            root.unmount();
          }
          popup?.remove();
          return true;
        }

        return component?.onKeyDown?.(props) || false;
      },

      onExit() {
        if (root) {
          root.unmount();
        }
        popup?.remove();
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
        command: ({ editor, range, props }: { editor: any; range: any; props: SlashCommandItem }) => {
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