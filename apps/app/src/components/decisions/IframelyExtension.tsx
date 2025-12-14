import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import {
  NodeViewWrapper,
  ReactNodeViewProps,
  ReactNodeViewRenderer,
} from '@tiptap/react';
import React from 'react';

import { LinkPreview } from '../LinkPreview';
import { shouldAutoEmbed } from './urlUtils';

interface IframelyOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    iframely: {
      /**
       * Insert an Iframely embed
       */
      setIframely: (options: { src: string }) => ReturnType;
    };
  }
}

const IframelyComponent: React.FC<ReactNodeViewProps> = ({ node }) => {
  const src = node.attrs.src as string;

  return (
    <NodeViewWrapper className="iframely-embed">
      <LinkPreview url={src} className="my-4" />
    </NodeViewWrapper>
  );
};

export const IframelyExtension = Node.create<IframelyOptions>({
  name: 'iframely',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-src'),
        renderHTML: (attributes) => {
          if (!attributes.src) {
            return {};
          }

          return {
            'data-src': attributes.src,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-iframely]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          const src = element.getAttribute('data-src');
          return src ? { src } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        { 'data-iframely': '' },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
    ];
  },

  addCommands() {
    return {
      setIframely:
        (options: { src: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(IframelyComponent);
  },

  addInputRules() {
    return [
      // Markdown-style input rule
      nodeInputRule({
        find: /^!\[iframely\]\((.+)\)$/,
        type: this.type,
        getAttributes: (match) => {
          const [, src] = match;
          return { src };
        },
      }),
      // Auto-embed URLs when followed by space or enter
      nodeInputRule({
        find: /(?:^|\s)(https?:\/\/[^\s]+)\s$/,
        type: this.type,
        getAttributes: (match) => {
          const [, src] = match;
          if (!src) return false;
          const embeddableUrl = shouldAutoEmbed(src);
          return embeddableUrl ? { src: embeddableUrl } : false;
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const nodeType = this.type;

    return [
      new Plugin({
        key: new PluginKey('iframely-paste-handler'),
        props: {
          handlePaste: (view, event) => {
            // Get the pasted content as plain text
            const text = event.clipboardData?.getData('text/plain');

            if (!text) {
              return false;
            }

            // Check if it's an embeddable URL
            const embeddableUrl = shouldAutoEmbed(text);

            if (embeddableUrl) {
              // Prevent default paste behavior
              event.preventDefault();

              // Insert the Iframely embed
              const { tr } = view.state;

              const node = nodeType.create({ src: embeddableUrl });
              const transaction = tr.replaceSelectionWith(node);

              view.dispatch(transaction);
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
