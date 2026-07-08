import { resolveExtensions } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { serverExtensions } from './tiptapExtensions';

/**
 * Duplicate extension names are more than a console warning: tiptap keeps both
 * copies, so both register their ProseMirror plugins/keymaps while only the
 * last one defines the schema. StarterKit bundles more extensions on major
 * upgrades (v3 added `link` and `underline`), which silently turned our
 * explicit registrations into duplicates. This guards the next bump.
 */
describe('serverExtensions', () => {
  it('has no duplicate extension names', () => {
    const names = resolveExtensions(serverExtensions).map((ext) => ext.name);
    const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
    expect([...new Set(duplicates)]).toEqual([]);
  });
});
