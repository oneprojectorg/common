import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { readFragmentText, writeFragmentText } from './fragmentText';

function getFragment(): Y.XmlFragment {
  return new Y.Doc().getXmlFragment('budget');
}

describe('fragment text', () => {
  it('reads back the text it wrote', () => {
    const fragment = getFragment();
    const text = JSON.stringify({ amount: 1200.5, currency: 'EUR' });

    writeFragmentText({ fragment, text });

    expect(readFragmentText(fragment)).toBe(text);
    expect(fragment.toString()).toBe(`<paragraph>${text}</paragraph>`);
  });

  it('replaces the previous value', () => {
    const fragment = getFragment();

    writeFragmentText({ fragment, text: 'Option A' });
    writeFragmentText({ fragment, text: 'Option B' });

    expect(readFragmentText(fragment)).toBe('Option B');
    expect(fragment.length).toBe(1);
  });

  it('empties the fragment for an empty value', () => {
    const fragment = getFragment();

    writeFragmentText({ fragment, text: 'Option A' });
    writeFragmentText({ fragment, text: '' });

    expect(fragment.length).toBe(0);
    expect(readFragmentText(fragment)).toBe('');
  });

  it('joins the text of every paragraph', () => {
    const fragment = getFragment();
    const first = new Y.XmlElement('paragraph');
    first.insert(0, [new Y.XmlText('Hello ')]);
    const second = new Y.XmlElement('paragraph');
    second.insert(0, [new Y.XmlText('world')]);
    fragment.insert(0, [first, second]);

    expect(readFragmentText(fragment)).toBe('Hello world');
  });
});
