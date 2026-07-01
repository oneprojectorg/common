/**
 * Shared error-state visuals for proposal fields (Figma: red label +
 * pink input surface for text editors, red outline for pill controls).
 *
 * No padding/size changes here on purpose — the error state must not shift
 * layout, especially since it clears on the user's first keystroke.
 */
export const INVALID_EDITOR_CLASS = 'rounded-lg bg-functional-red-50';
export const INVALID_PILL_CLASS = 'outline outline-1 outline-functional-red';

/**
 * DOM id of a field's rendered error message (see ProposalFormRenderer),
 * used as the `aria-describedby` target on the field's input element.
 */
export function getFieldErrorId(key: string): string {
  return `field-error-${key}`;
}
