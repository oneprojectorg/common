/**
 * Pure style-string constants for TipTap-rendered prose. Deliberately free of
 * any TipTap import: viewer-only consumers (the static HTML proposal viewer,
 * the RSC rich-text renderer) import from this subpath so the TipTap editor
 * machinery in `editorConfig` never enters their bundle graph.
 */

/**
 * Prose typography styles shared between the TipTap editor/viewer and the
 * static HTML proposal viewer (`ProposalHtmlContent`).
 *
 * Covers link colors, list spacing, blockquote weight, prose-context heading
 * margins, and general text layout. Heading typography itself is applied on
 * the heading tags via `StyledHeading` so it stays in sync with the
 * `Header*` design-system components.
 */
export const viewerProseStyles = [
  'prose text-foreground leading-normal',
  '[&_a:hover]:underline [&_a]:text-primary [&_a]:no-underline',
  '[&_li>p:only-child]:my-0',
  '[&_blockquote]:font-normal',
  '[&_:is(h1,h2,h3)]:my-4',
  // Per-block bidi: each paragraph/heading/list-item resolves its own
  // direction from content, so mixed LTR/RTL prose aligns correctly without
  // a per-element dir attribute (text-align: start follows each block's dir).
  '[&_:is(p,h1,h2,h3,h4,li,blockquote)]:[unicode-bidi:plaintext]',
  // ...except when the block has no content to resolve from. `plaintext` runs
  // UAX9 P2/P3, and P3 makes a paragraph with no strong character LTR — it does
  // not fall back to the element's direction. That put the caret (and an empty
  // editor's placeholder) on the left of an Arabic page until the first letter
  // was typed. Empty blocks inherit the surrounding direction instead.
  // ProseMirror fills an empty textblock with a trailing <br>, so `:empty` only
  // covers the static viewer.
  '[&_:is(p,h1,h2,h3,h4,li,blockquote):empty]:[unicode-bidi:normal]',
  // `br:only-child` rather than the trailing-break class: it covers both the
  // hack node ProseMirror puts in an empty textblock and a block holding only a
  // hard break (Shift+Enter), which serialises to a bare `<br>` in the viewer.
  '[&_:is(p,h1,h2,h3,h4,li,blockquote):has(>br:only-child)]:[unicode-bidi:normal]',
  'max-w-none break-words',
  // Details/Summary (collapsible) chrome lives in one raw-CSS block in
  // `@op/styles` (`.details` in theme.css), shared by the editor's
  // built-in node view AND the viewer's native <details>. Nothing here.
].join(' ');

/**
 * Placeholder hint shown once when the editor is empty. Targets the
 * Placeholder extension's `is-editor-empty` class (root-empty only), so it
 * never repeats per block. Inert unless the Placeholder extension is active
 * (i.e. a `placeholder` was passed), since `data-placeholder` is absent otherwise.
 */
const placeholderStyles = [
  '[&_.is-editor-empty:first-child]:before:pointer-events-none',
  '[&_.is-editor-empty:first-child]:before:float-start',
  '[&_.is-editor-empty:first-child]:before:h-0',
  '[&_.is-editor-empty:first-child]:before:text-muted-foreground',
  '[&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
].join(' ');

/**
 * Per-node placeholder for an empty Details summary. Scoped to `summary.is-empty`
 * (not the global `.is-empty`) so only the Details summary gets a hint — other
 * empty blocks are unaffected. Requires `Placeholder.configure({ includeChildren:
 * true })`, which `useRichTextEditor` wires when the Details extension is present.
 */
const detailsSummaryPlaceholderStyles = [
  '[&_summary.is-empty]:before:pointer-events-none',
  // float-start + h-0 pull the ::before out of the text flow so the caret sits
  // at the start of the summary, not after the placeholder text.
  '[&_summary.is-empty]:before:float-start',
  '[&_summary.is-empty]:before:h-0',
  '[&_summary.is-empty]:before:text-muted-foreground',
  '[&_summary.is-empty]:before:content-[attr(data-placeholder)]',
  '[&_summary.is-empty]:before:font-serif',
].join(' ');

/**
 * Styles applied to the editor element
 */
// Standard sense focus ring on the editable itself (for bare editors), but
// suppressed inside a `[data-slot=rich-text-editor-field]` container — there the
// field rings via focus-within so the whole box (toolbar + editable) lights up.
// `whitespace-pre-wrap` is what ProseMirror expects (its own stylesheet sets it).
// Without it Firefox takes the `requiresGeckoHackNode` path and appends a
// trailing <br> to any block whose text ends in a space, which would match the
// empty-block selector above and drop that paragraph out of per-line bidi.
export const baseEditorStyles = `${viewerProseStyles} whitespace-pre-wrap rounded-lg outline-hidden focus-visible:ring-3 focus-visible:ring-ring/50 in-data-[slot=rich-text-editor-field]:focus-visible:ring-0 ${placeholderStyles} ${detailsSummaryPlaceholderStyles}`;
