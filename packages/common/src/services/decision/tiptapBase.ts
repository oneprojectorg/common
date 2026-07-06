import { headingClasses } from '@op/styles/constants';
import { type AnyExtension, mergeAttributes } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';

/**
 * TipTap heading extension that bakes the design-system `headingClasses` onto
 * each rendered `<h1>`–`<h4>` tag, keeping editor output visually identical to
 * the `Header1/2/3/4` components in `@op/ui`. Any level without a mapped class
 * renders without a baked class.
 *
 * The single definition shared by the live editors (via `@op/ui`'s
 * `buildBaseExtensions`) and the server-side renderers (`serverExtensions`),
 * so editor output and generated HTML can't drift.
 */
export const StyledHeading = Heading.extend({
  renderHTML({ node, HTMLAttributes }) {
    const level = node.attrs.level as 1 | 2 | 3 | 4;
    const className =
      headingClasses[`h${level}` as keyof typeof headingClasses];
    return [
      `h${level}`,
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        className ? { class: className } : {},
      ),
      0,
    ];
  },
});

export interface SharedTiptapBaseOptions {
  /** Disables local undo/redo so Yjs collaboration can own history. */
  collaborative?: boolean;
  link?: {
    openOnClick?: boolean;
    linkOnPaste?: boolean;
  };
}

/**
 * The canonical shared TipTap extension set: everything that both the live
 * editors/viewers (`@op/ui` layers client-only extensions on top) and the
 * server-side renderers (`serverExtensions` layers schema-only node stubs on
 * top) must agree on. Every extension — StarterKit options included — is
 * registered exactly once here; consumers append, never filter or
 * re-register.
 *
 * StarterKit already bundles underline, strike, blockquote and horizontalRule
 * — don't re-add them or tiptap warns about duplicate extension names.
 * heading/link are disabled in StarterKit because the configured
 * StyledHeading/Link below take their place.
 */
export function buildSharedTiptapBase(
  options: SharedTiptapBaseOptions = {},
): AnyExtension[] {
  const { collaborative = false, link } = options;

  return [
    StarterKit.configure({
      heading: false,
      link: false,
      undoRedo: collaborative ? false : undefined,
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Image.configure({
      inline: true,
      allowBase64: true,
    }),
    StyledHeading.configure({
      levels: [1, 2, 3, 4],
    }),
    Link.configure({
      openOnClick: false,
      ...link,
    }),
  ];
}
