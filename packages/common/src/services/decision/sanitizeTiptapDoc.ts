import { getSchema } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';

import { tiptapDocToPlainText } from './tiptapDocToPlainText';
import { serverExtensions } from './tiptapExtensions';

/**
 * Coerce a stored TipTap doc so it contains only node/mark types the server
 * schema knows. The static renderer parses JSON eagerly (`Node.fromJSON`) and
 * THROWS on an unregistered type, which would crash the whole render. Sanitizing
 * first lets the known content render rich and degrades only the unsupported
 * pieces — far better than the all-or-nothing plain-text fallback (which stays
 * as a backstop for failures sanitizing can't prevent, e.g. content-model
 * violations from the coercion).
 *
 * Rules:
 *  - unknown CONTAINER node (has block children) → unwrapped; its sanitized
 *    children splice up in place (a details node becomes its summary + body
 *    blocks instead of one flattened run).
 *  - unknown LEAF/inline-only node → replaced by a paragraph of its flat text.
 *  - unknown marks → stripped off text nodes (they throw too).
 */
// Built once: the registered node/mark names + which nodes are textblocks.
const schema = getSchema(serverExtensions);

const isKnownNode = (type: string | undefined): boolean =>
  type !== undefined && type in schema.nodes;

const isTextblock = (type: string): boolean =>
  schema.nodes[type]?.isTextblock ?? false;

const isKnownMark = (type: string | undefined): boolean =>
  type !== undefined && type in schema.marks;

function sanitizeTextNode(node: JSONContent): JSONContent {
  if (!node.marks || node.marks.length === 0) {
    return node;
  }

  const marks = node.marks.filter((mark) => isKnownMark(mark.type));
  if (marks.length === node.marks.length) {
    return node;
  }

  return { ...node, marks };
}

function sanitizeBlocks(nodes: JSONContent[]): JSONContent[] {
  const out: JSONContent[] = [];

  for (const node of nodes) {
    if (typeof node.type !== 'string') {
      continue;
    }

    if (isKnownNode(node.type)) {
      if (isTextblock(node.type)) {
        // Inline content — keep the block, just clean marks off its text leaves.
        out.push({ ...node, content: node.content?.map(sanitizeTextNode) });
      } else {
        out.push({
          ...node,
          content: node.content ? sanitizeBlocks(node.content) : node.content,
        });
      }

      continue;
    }

    // Unknown node. If it wraps block-level children, unwrap them so known
    // inner blocks survive rich; otherwise flatten it to a single paragraph.
    const hasBlockChildren = (node.content ?? []).some(
      (child) => child.type !== undefined && child.type !== 'text',
    );

    if (hasBlockChildren) {
      out.push(...sanitizeBlocks(node.content ?? []));
    } else {
      const text = tiptapDocToPlainText({ type: 'doc', content: [node] });
      if (text) {
        out.push({ type: 'paragraph', content: [{ type: 'text', text }] });
      }
    }
  }

  return out;
}

export function sanitizeTiptapDoc(doc: JSONContent): JSONContent {
  if (!doc?.content) {
    return doc;
  }

  return { ...doc, content: sanitizeBlocks(doc.content) };
}
