/**
 * TipTap schema for the process Overview editor.
 *
 * The Overview is a single editor with a fixed document structure enforced
 * at the ProseMirror schema level:
 *
 *   doc := overviewTitle overviewSubhead horizontalRule block+
 *
 * The title, subhead, and leading horizontal rule are required by the
 * content expression, so they cannot be deleted, reordered, or duplicated —
 * invalid transactions are rejected by ProseMirror. Users can still add
 * their own horizontal rules in the body section below the fixed one.
 *
 * Title and subhead disallow marks and block content, so their plain text
 * can be stored as strings (`headline`, `description`) and rendered on
 * other pages without parsing a TipTap document. Only the body is stored
 * as TipTap JSON (`content`).
 */
import { Extension, Node } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Placeholder from '@tiptap/extension-placeholder';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import type { AnyExtension, Editor, JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import type { TranslateFn } from '@/lib/i18n';

/** The overview parts persisted in `instanceData.overview` */
export interface OverviewParts {
  headline: string;
  description: string;
  /** TipTap JSON document for the body (everything below the fixed rule) */
  content?: Record<string, unknown>;
}

const OverviewDocument = Document.extend({
  content: 'overviewTitle overviewSubhead horizontalRule block+',
});

/** Returns the document position just inside the top-level child at `index`. */
function nodeStartPos(doc: ProseMirrorNode, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i++) {
    pos += doc.child(i).nodeSize;
  }
  return pos + 1;
}

/** Moves the cursor to the start of the top-level child at `index`. */
function focusChild(editor: Editor, index: number): boolean {
  return editor
    .chain()
    .focus()
    .setTextSelection(nodeStartPos(editor.state.doc, index))
    .run();
}

const OverviewTitle = Node.create({
  name: 'overviewTitle',
  content: 'inline*',
  marks: '',
  defining: true,

  parseHTML() {
    return [{ tag: 'h1' }];
  },

  renderHTML() {
    return ['h1', 0];
  },

  addKeyboardShortcuts() {
    // Enter/Tab move to the subhead instead of splitting the title
    const goToSubhead = ({ editor }: { editor: Editor }) => {
      if (editor.state.selection.$from.parent.type.name !== this.name) {
        return false;
      }
      return focusChild(editor, 1);
    };

    return {
      Enter: goToSubhead,
      Tab: goToSubhead,
    };
  },
});

const OverviewSubhead = Node.create({
  name: 'overviewSubhead',
  content: 'inline*',
  marks: '',
  defining: true,

  parseHTML() {
    return [{ tag: 'p[data-overview-subhead]' }];
  },

  renderHTML() {
    return ['p', { 'data-overview-subhead': '' }, 0];
  },

  addKeyboardShortcuts() {
    // Enter/Tab move past the fixed rule into the body
    const goToBody = ({ editor }: { editor: Editor }) => {
      if (editor.state.selection.$from.parent.type.name !== this.name) {
        return false;
      }
      return focusChild(editor, 3);
    };

    return {
      Enter: goToBody,
      Tab: goToBody,
    };
  },
});

/** Node types that only accept plain inline text */
const PLAIN_TEXT_NODES = new Set(['overviewTitle', 'overviewSubhead']);

/**
 * Coerces pastes into the title/subhead to plain text. Without this,
 * multi-block pastes split the node: the first block lands in the
 * title/subhead and the remaining blocks flow into the body.
 */
const OverviewPasteHandler = Extension.create({
  name: 'overviewPasteHandler',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (view, _event, slice) => {
            const { $from } = view.state.selection;
            if (!PLAIN_TEXT_NODES.has($from.parent.type.name)) {
              return false;
            }

            const text = slice.content
              .textBetween(0, slice.content.size, ' ', ' ')
              .replace(/\s+/g, ' ')
              .trim();
            view.dispatch(view.state.tr.insertText(text));
            return true;
          },
        },
      }),
    ];
  },
});

/** Index of the fixed horizontal rule in the top-level document. */
const FIXED_RULE_INDEX = 2;

export function getOverviewEditorExtensions(t: TranslateFn): AnyExtension[] {
  return [
    StarterKit.configure({
      document: false,
      link: { openOnClick: false },
    }),
    OverviewDocument,
    OverviewTitle,
    OverviewSubhead,
    OverviewPasteHandler,
    Placeholder.configure({
      showOnlyCurrent: false,
      placeholder: ({ editor, node, pos }) => {
        if (node.type.name === 'overviewTitle') {
          return t('Add a headline');
        }
        if (node.type.name === 'overviewSubhead') {
          return t(
            'Add a short description — one or two lines that sit under the headline.',
          );
        }
        // Body placeholder: only on the first body paragraph, and only while
        // it is the sole body node (mirrors the standard empty-editor hint)
        const doc = editor.state.doc;
        const isFirstBodyNode =
          pos === nodeStartPos(doc, FIXED_RULE_INDEX + 1) - 1;
        if (isFirstBodyNode && doc.childCount === FIXED_RULE_INDEX + 2) {
          return t(
            "Write what residents need to know about this process — its goals, timeline, who's running it, how to participate.",
          );
        }
        return '';
      },
    }),
  ];
}

/** Builds the initial editor document from stored overview parts. */
export function buildOverviewDoc(parts: OverviewParts): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'overviewTitle',
        content: parts.headline
          ? [{ type: 'text', text: parts.headline }]
          : undefined,
      },
      {
        type: 'overviewSubhead',
        content: parts.description
          ? [{ type: 'text', text: parts.description }]
          : undefined,
      },
      { type: 'horizontalRule' },
      ...getBodyNodes(parts.content),
    ],
  };
}

/** Splits the editor document back into storable overview parts. */
export function extractOverviewParts(doc: ProseMirrorNode): OverviewParts {
  const bodyNodes: Record<string, unknown>[] = [];
  doc.forEach((node, _offset, index) => {
    if (index > FIXED_RULE_INDEX) {
      bodyNodes.push(node.toJSON());
    }
  });

  return {
    headline: doc.child(0).textContent,
    description: doc.child(1).textContent,
    content: { type: 'doc', content: bodyNodes },
  };
}

function getBodyNodes(content: Record<string, unknown> | undefined): JSONContent[] {
  const nodes = content?.content;
  if (Array.isArray(nodes) && nodes.length > 0) {
    return nodes;
  }
  return [{ type: 'paragraph' }];
}
