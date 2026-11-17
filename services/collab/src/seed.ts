import * as Y from 'yjs';

/**
 * Plain text for one named fragment of a new collaborative document.
 *
 * - `line`: a single paragraph, as `CollaborativeTitleField` writes it. Line
 *   breaks and whitespace runs collapse to one space, as a paste does there.
 * - `paragraphs`: one paragraph per line, as a rich text field
 *   (`CollaborativeTextField`) writes plain text.
 */
export type SeedFragment = {
  kind: 'line' | 'paragraphs';
  text: string;
};

/** Fragment name → its plain text. Empty fragments are left out. */
export type SeedFragments = Record<string, SeedFragment>;

/**
 * Encodes the fragments as one Yjs update. Each fragment holds the node tree
 * that the TipTap Collaboration extension (y-prosemirror) writes for plain
 * text: `XmlElement('paragraph')` nodes, each with one `XmlText`.
 */
export function encodeSeedUpdate(
  fragments: SeedFragments,
): Uint8Array<ArrayBuffer> {
  const ydoc = new Y.Doc();

  for (const [fragmentName, fragment] of Object.entries(fragments)) {
    const paragraphs = toParagraphs(fragment);

    if (paragraphs.length === 0) {
      continue;
    }

    ydoc.getXmlFragment(fragmentName).insert(0, paragraphs.map(toParagraph));
  }

  // Copied so the bytes sit on a plain `ArrayBuffer`, which `fetch` accepts.
  return new Uint8Array(Y.encodeStateAsUpdate(ydoc));
}

function toParagraphs({ kind, text }: SeedFragment): string[] {
  if (kind === 'line') {
    const line = text.replace(/\s+/g, ' ').trim();
    return line ? [line] : [];
  }

  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\r?\n/).map((line) => line.trimEnd()) : [];
}

function toParagraph(text: string): Y.XmlElement {
  const paragraph = new Y.XmlElement('paragraph');

  // An empty line is an empty paragraph, as the editor stores a blank line.
  if (text) {
    paragraph.insert(0, [new Y.XmlText(text)]);
  }

  return paragraph;
}
