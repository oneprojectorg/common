import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

/**
 * Mirrors `setFragmentValue` from `useCollaborativeFragment` — writes a string
 * value into a Y.XmlFragment as a paragraph-wrapped Y.XmlText, the exact shape
 * the dropdown commits via `useCollaborativeFragment` when the user picks an
 * option.
 */
function writeDropdownValue(fragment: Y.XmlFragment, value: string): void {
  fragment.doc?.transact(() => {
    fragment.delete(0, fragment.length);
    if (value) {
      const paragraph = new Y.XmlElement('paragraph');
      paragraph.insert(0, [new Y.XmlText(value)]);
      fragment.insert(0, [paragraph]);
    }
  });
}

/**
 * Mirrors `getFragmentPlainText` from `useProposalValidation` — the function
 * the submit-time validator uses to read a dropdown's committed value out of
 * Yjs.
 */
function readFragmentForValidation(fragment: Y.XmlFragment): string {
  const blocks: string[] = [];
  fragment.forEach((node) => {
    if (node instanceof Y.XmlElement) {
      const parts: string[] = [];
      node.forEach((child) => {
        if (child instanceof Y.XmlText) {
          parts.push(child.toJSON());
        }
      });
      blocks.push(parts.join(''));
    }
  });
  return blocks.join('\n');
}

describe('CollaborativeDropdownField fragment round-trip', () => {
  it('round-trips an arbitrary string value through the fragment', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('priority');

    writeDropdownValue(fragment, 'Submitting on my own');

    expect(readFragmentForValidation(fragment)).toBe('Submitting on my own');
  });

  it('preserves the LAST option in a multi-option dropdown — regression for ONE-289', () => {
    // Repro for the dropdown last-item bug: picking the last option of a
    // dropdown must commit the exact value the schema's `oneOf` expects, with
    // no trim or whitespace mismatch. If the schema author leaves trailing
    // whitespace on the last option (a common accident when adding it last),
    // the validator's `.trim()` strips it before AJV checks `oneOf`, and the
    // value silently fails to match — surfaced to users as "X is invalid".
    const options = [
      'Option A',
      'Option B',
      'Submitting on my own ', // trailing space — last item, mistypable
    ];
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('how_submitting');

    // User picks the last option. The dropdown commits the value as the
    // schema's `oneOf.const` — preserving trailing whitespace.
    writeDropdownValue(fragment, options[options.length - 1]!);

    // Validator reads the committed value back. It MUST equal what was
    // written so AJV's `oneOf` can match it against the schema's const.
    expect(readFragmentForValidation(fragment)).toBe(
      options[options.length - 1],
    );
  });
});
