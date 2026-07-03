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
  'prose prose-lg !text-base text-neutral-black',
  '[&_a:hover]:underline [&_a]:text-teal [&_a]:no-underline',
  '[&_li_p]:my-0',
  '[&_blockquote]:font-normal',
  '[&_:is(h1,h2,h3)]:my-4',
  // Per-block bidi: each paragraph/heading/list-item resolves its own
  // direction from content, so mixed LTR/RTL prose aligns correctly without
  // a per-element dir attribute (text-align: start follows each block's dir).
  '[&_:is(p,h1,h2,h3,h4,li,blockquote)]:[unicode-bidi:plaintext]',
  'leading-5 max-w-none break-words overflow-wrap-anywhere',
  // Details/Summary (collapsible) chrome lives in one raw-CSS block in
  // `@op/styles` (`.details` in shared-styles.css), shared by the editor's
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
  '[&_.is-editor-empty:first-child]:before:text-neutral-gray3',
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
  '[&_summary.is-empty]:before:text-neutral-gray3',
  '[&_summary.is-empty]:before:content-[attr(data-placeholder)]',
  '[&_summary.is-empty]:before:font-serif',
].join(' ');

/**
 * Styles applied to the editor element
 */
export const baseEditorStyles = `${viewerProseStyles} outline-hidden placeholder:text-neutral-gray2 ${placeholderStyles} ${detailsSummaryPlaceholderStyles}`;
