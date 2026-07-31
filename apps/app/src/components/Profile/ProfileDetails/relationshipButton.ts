// Teal treatment for relationship action buttons (Figma "Relationship Mgmt").
// The confirmed state reuses the design system's selected/toggle-on styling
// (sense Toggle on-state: bg-accent + accent-foreground text/border), so both
// classes share teal `accent-foreground` border + text; the fill differs:
// - PENDING (unconfirmed) → white interior (outline look), teal-50 tint on hover.
// - ACTIVE (confirmed)    → teal-50 (accent) fill at rest.
// Distinct from the neutral `outline` variant ("Fund") and the teal-fill
// `default` variant ("Add relationship"). Pair with `variant="outline"`.
const base =
  'border-accent-foreground text-accent-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent';

export const relationshipPendingButtonClass = base;
export const relationshipActiveButtonClass = `${base} bg-accent`;
