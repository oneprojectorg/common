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
 * their own horizontal rules in the body section below the fixed one (a
 * body rule directly after the fixed one can be promoted into its slot,
 * which is harmless since extraction is positional).
 *
 * Title and subhead only allow plain text (`content: 'text*'` — no marks,
 * no inline nodes like hard breaks), so their content can be stored as
 * strings (`headline`, `description`) and rendered on other pages without
 * parsing a TipTap document. Only the body is stored as TipTap JSON
 * (`content`).
 */
import { Extension, Node } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Placeholder from '@tiptap/extension-placeholder';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import type { AnyExtension, Editor, JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import type { TranslateFn } from '@/lib/i18n';

/** TipTap JSON document holding the overview body */
export interface OverviewBodyDoc {
  type: 'doc';
  content?: Record<string, unknown>[];
}

/** The overview parts persisted in `instanceData.overview` */
export interface OverviewParts {
  headline: string;
  description: string;
  /** TipTap JSON document for the body (everything below the fixed rule) */
  content?: OverviewBodyDoc;
}

/** Index of the fixed horizontal rule in the top-level document. */
const FIXED_RULE_INDEX = 2;

/** Index of the first body node (right after the fixed rule). */
const BODY_START_INDEX = FIXED_RULE_INDEX + 1;

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

/**
 * Enter/Tab in `fromNode` advance the cursor to the top-level child at
 * `toIndex` (the schema blocks splitting, so Enter would otherwise no-op).
 */
function advanceCursorShortcuts(fromNode: string, toIndex: number) {
  const move = ({ editor }: { editor: Editor }) => {
    if (editor.state.selection.$from.parent.type.name !== fromNode) {
      return false;
    }
    return focusChild(editor, toIndex);
  };

  return {
    Enter: move,
    Tab: move,
  };
}

const OverviewTitle = Node.create({
  name: 'overviewTitle',
  content: 'text*',
  marks: '',
  defining: true,

  parseHTML() {
    return [{ tag: 'h1' }];
  },

  renderHTML() {
    return ['h1', 0];
  },

  addKeyboardShortcuts() {
    return advanceCursorShortcuts(this.name, 1);
  },
});

const OverviewSubhead = Node.create({
  name: 'overviewSubhead',
  content: 'text*',
  marks: '',
  defining: true,

  parseHTML() {
    return [{ tag: 'p[data-overview-subhead]' }];
  },

  renderHTML() {
    return ['p', { 'data-overview-subhead': '' }, 0];
  },

  addKeyboardShortcuts() {
    return advanceCursorShortcuts(this.name, BODY_START_INDEX);
  },
});

/** Node types that only accept plain text */
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
            if (!text) {
              // Nothing textual to insert (e.g. an image) — let the default
              // schema-filtered handling run instead of eating the event
              return false;
            }
            view.dispatch(view.state.tr.insertText(text));
            return true;
          },
        },
      }),
    ];
  },
});

/**
 * True when the selection sits entirely in the body (at or below the first
 * body node). Used to hide formatting UI in the title/subhead and on the
 * fixed rule, where the schema blocks marks and block changes anyway.
 */
export function isSelectionInBody(editor: Editor): boolean {
  const { doc, selection } = editor.state;
  // Position just before the first body node
  const bodyStart = nodeStartPos(doc, BODY_START_INDEX) - 1;
  return selection.$from.pos >= bodyStart;
}

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
        // Body placeholder: only on the first body node, and only while
        // it is the sole body node (mirrors the standard empty-editor hint)
        const doc = editor.state.doc;
        const isFirstBodyNode = pos === nodeStartPos(doc, BODY_START_INDEX) - 1;
        if (isFirstBodyNode && doc.childCount === BODY_START_INDEX + 1) {
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

/**
 * Splits the editor document back into storable overview parts.
 *
 * Throws when the document doesn't match the fixed structure — the schema
 * guarantees it always does, so a violation here means the schema and this
 * extraction have drifted apart, and failing loudly beats silently
 * persisting miscategorized data.
 */
export function extractOverviewParts(doc: ProseMirrorNode): OverviewParts {
  const hasFixedStructure =
    doc.childCount > FIXED_RULE_INDEX &&
    doc.child(0).type.name === 'overviewTitle' &&
    doc.child(1).type.name === 'overviewSubhead' &&
    doc.child(FIXED_RULE_INDEX).type.name === 'horizontalRule';
  if (!hasFixedStructure) {
    throw new Error(
      'Overview document does not match the fixed structure (title, subhead, rule, body)',
    );
  }

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

function getBodyNodes(content: OverviewBodyDoc | undefined): JSONContent[] {
  if (!content) {
    return [{ type: 'paragraph' }];
  }

  // Runtime guard: stored data (localStorage, API) may not match the type
  const nodes: unknown = content.content;
  if (!Array.isArray(nodes)) {
    if (nodes !== undefined) {
      console.error(
        'Malformed overview body content; starting with an empty body',
        content,
      );
    }
    return [{ type: 'paragraph' }];
  }

  return nodes.length > 0 ? nodes : [{ type: 'paragraph' }];
}
