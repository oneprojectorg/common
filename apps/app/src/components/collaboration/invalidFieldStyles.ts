/**
 * Shared error-state visuals for proposal fields (Figma: red label +
 * pink input surface for text editors, red outline for pill controls).
 *
 * No padding/size changes here on purpose — the error state must not shift
 * layout, especially since it clears on the user's first keystroke.
 */
export const INVALID_EDITOR_CLASS = 'bg-functional-red-50';
export const INVALID_PILL_CLASS = 'outline outline-1 outline-functional-red';

/**
 * DOM attribute carrying each field's key on its wrapper in
 * ProposalFormRenderer. The editor uses it to locate and scroll to invalid
 * fields after a failed submit; the wrapper also exposes `data-invalid` for
 * tests.
 */
export const FIELD_ANCHOR_ATTR = 'data-field-anchor';

/**
 * DOM id of a field's rendered error message (see ProposalFormRenderer),
 * used as the `aria-describedby` target on the field's input element.
 */
export function getFieldErrorId(key: string): string {
  return `field-error-${key}`;
}
