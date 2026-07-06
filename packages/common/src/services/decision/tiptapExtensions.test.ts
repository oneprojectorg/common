import { getSchema, resolveExtensions } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { buildSharedTiptapBase } from './tiptapBase';
import { serverExtensions } from './tiptapExtensions';

/**
 * Duplicate extension names are more than a console warning: tiptap keeps both
 * copies, so both register their ProseMirror plugins/keymaps while only the
 * last one defines the schema. StarterKit bundles more extensions on major
 * upgrades (v3 added `link` and `underline`), which silently turned our
 * explicit registrations into duplicates. This guards the next bump.
 */
/**
 * Node types the client editors register beyond the shared base
 * (React/PM-plugin extensions living in @op/ui and apps/app). Their
 * schema-only server stubs must exist in `serverExtensions`, or content using
 * them is silently dropped by `generateHTML()` — and JSON loaded back into an
 * editor with an unknown type blanks the whole doc.
 */
const CLIENT_ONLY_NODE_NAMES = [
  'details',
  'detailsSummary',
  'detailsContent',
  'iframely',
];

describe('serverExtensions', () => {
  it('has no duplicate extension names', () => {
    const names = resolveExtensions(serverExtensions).map((ext) => ext.name);
    const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
    expect([...new Set(duplicates)]).toEqual([]);
  });

  it('covers every node and mark the editors can produce', () => {
    const serverSchema = getSchema(serverExtensions);
    const serverNames = new Set([
      ...Object.keys(serverSchema.nodes),
      ...Object.keys(serverSchema.marks),
    ]);

    const editorBaseSchema = getSchema(buildSharedTiptapBase());
    const requiredNames = [
      ...Object.keys(editorBaseSchema.nodes),
      ...Object.keys(editorBaseSchema.marks),
      ...CLIENT_ONLY_NODE_NAMES,
    ];

    const missing = requiredNames.filter((name) => !serverNames.has(name));
    expect(missing).toEqual([]);
  });
});
