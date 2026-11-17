import * as Y from 'yjs';

/** Copies fragment `from` of the source document into fragment `to`. */
export type FragmentCopy = {
  /** The source document as a binary Yjs update. */
  sourceUpdate: Uint8Array;
  from: string;
  to: string;
};

/**
 * Builds one Yjs update for a new document from fragments of other
 * documents. Nodes are deep-cloned, so their attributes and text marks come
 * along. An empty or missing source fragment adds nothing; when nothing is
 * copied the result is null.
 */
export function encodeFragmentCopies(
  copies: FragmentCopy[],
): Uint8Array<ArrayBuffer> | null {
  const sourceDocs = new Map<Uint8Array, Y.Doc>();
  const target = new Y.Doc();
  let copied = false;

  for (const { sourceUpdate, from, to } of copies) {
    let source = sourceDocs.get(sourceUpdate);
    if (!source) {
      source = new Y.Doc();
      Y.applyUpdate(source, sourceUpdate);
      sourceDocs.set(sourceUpdate, source);
    }

    const nodes = source
      .getXmlFragment(from)
      .toArray()
      .flatMap((node) =>
        node instanceof Y.XmlElement || node instanceof Y.XmlText
          ? [node.clone()]
          : [],
      );
    if (nodes.length === 0) {
      continue;
    }

    const fragment = target.getXmlFragment(to);
    fragment.insert(fragment.length, nodes);
    copied = true;
  }

  // Copied so the bytes sit on a plain `ArrayBuffer`, which `fetch` accepts.
  return copied ? new Uint8Array(Y.encodeStateAsUpdate(target)) : null;
}
