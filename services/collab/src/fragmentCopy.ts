import * as Y from 'yjs';

/** Copies fragment `from` of the source document into fragment `to`. */
export type FragmentCopy = {
  sourceUpdate: Uint8Array;
  from: string;
  to: string;
};

/**
 * One Yjs update of deep-cloned source fragments, marks and attributes kept.
 * A target takes its first non-empty copy; null when nothing is copied.
 */
export function encodeFragmentCopies(
  copies: FragmentCopy[],
): Uint8Array<ArrayBuffer> | null {
  const sourceDocs = new Map<Uint8Array, Y.Doc>();
  const filledTargets = new Set<string>();
  const target = new Y.Doc();

  for (const { sourceUpdate, from, to } of copies) {
    if (filledTargets.has(to)) {
      continue;
    }

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

    target.getXmlFragment(to).insert(0, nodes);
    filledTargets.add(to);
  }

  // Copied so the bytes sit on a plain `ArrayBuffer`, which `fetch` accepts.
  return filledTargets.size > 0
    ? new Uint8Array(Y.encodeStateAsUpdate(target))
    : null;
}
