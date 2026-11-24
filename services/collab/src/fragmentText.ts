import * as Y from 'yjs';

// A field that is not rich text keeps its value as one string in one
// paragraph, so TipTap Cloud serialises the fragment as valid ProseMirror JSON.

/** The text of each paragraph in the fragment, joined. */
export function readFragmentText(fragment: Y.XmlFragment): string {
  const parts: string[] = [];
  fragment.forEach((node) => {
    if (node instanceof Y.XmlElement) {
      node.forEach((child) => {
        if (child instanceof Y.XmlText) {
          parts.push(child.toJSON());
        }
      });
    }
  });
  return parts.join('');
}

/** Replaces the fragment's content with one paragraph of `text`; empties it for `''`. */
export function writeFragmentText({
  fragment,
  text,
}: {
  fragment: Y.XmlFragment;
  text: string;
}): void {
  fragment.delete(0, fragment.length);
  if (text) {
    const paragraph = new Y.XmlElement('paragraph');
    paragraph.insert(0, [new Y.XmlText(text)]);
    fragment.insert(0, [paragraph]);
  }
}
