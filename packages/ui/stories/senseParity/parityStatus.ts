// Figma parity status for every @op/sense primitive.
//
// A primitive is 'done' when its restyle has been verified against the Common
// Sense Figma component masters and it has a row in a Figma Parity story.
// Family PRs flip their primitives' statuses as they land.

export type ParityStatus = 'todo' | 'in-progress' | 'done';

export type ParityFamily =
  | 'form-inputs'
  | 'buttons-toggles'
  | 'overlays'
  | 'menus-navigation'
  | 'data-display'
  | 'feedback'
  | 'date-layout';

export const parityStatus: Record<
  string,
  { family: ParityFamily; status: ParityStatus }
> = {
  // Form inputs
  input: { family: 'form-inputs', status: 'done' },
  textarea: { family: 'form-inputs', status: 'done' },
  field: { family: 'form-inputs', status: 'done' },
  label: { family: 'form-inputs', status: 'done' },
  checkbox: { family: 'form-inputs', status: 'done' },
  'input-group': { family: 'form-inputs', status: 'done' },
  'radio-group': { family: 'form-inputs', status: 'done' },
  switch: { family: 'form-inputs', status: 'done' },
  slider: { family: 'form-inputs', status: 'done' },
  select: { family: 'form-inputs', status: 'done' },
  'native-select': { family: 'form-inputs', status: 'done' },
  combobox: { family: 'form-inputs', status: 'done' },
  'input-otp': { family: 'form-inputs', status: 'done' },

  // Buttons & toggles
  button: { family: 'buttons-toggles', status: 'done' },
  'button-group': { family: 'buttons-toggles', status: 'done' },
  toggle: { family: 'buttons-toggles', status: 'done' },
  'toggle-group': { family: 'buttons-toggles', status: 'done' },

  // Overlays
  dialog: { family: 'overlays', status: 'done' },
  'alert-dialog': { family: 'overlays', status: 'done' },
  sheet: { family: 'overlays', status: 'done' },
  drawer: { family: 'overlays', status: 'done' },
  popover: { family: 'overlays', status: 'done' },
  tooltip: { family: 'overlays', status: 'done' },
  'hover-card': { family: 'overlays', status: 'done' },

  // Menus & navigation
  'dropdown-menu': { family: 'menus-navigation', status: 'done' },
  'context-menu': { family: 'menus-navigation', status: 'done' },
  menubar: { family: 'menus-navigation', status: 'done' },
  'navigation-menu': { family: 'menus-navigation', status: 'done' },
  breadcrumb: { family: 'menus-navigation', status: 'done' },
  tabs: { family: 'menus-navigation', status: 'done' },
  sidebar: { family: 'menus-navigation', status: 'done' },
  pagination: { family: 'menus-navigation', status: 'done' },
  command: { family: 'menus-navigation', status: 'done' },

  // Data display
  table: { family: 'data-display', status: 'done' },
  card: { family: 'data-display', status: 'done' },
  badge: { family: 'data-display', status: 'done' },
  avatar: { family: 'data-display', status: 'done' },
  accordion: { family: 'data-display', status: 'done' },
  collapsible: { family: 'data-display', status: 'done' },
  separator: { family: 'data-display', status: 'done' },
  item: { family: 'data-display', status: 'done' },
  empty: { family: 'data-display', status: 'done' },
  kbd: { family: 'data-display', status: 'done' },
  'aspect-ratio': { family: 'data-display', status: 'done' },
  carousel: { family: 'data-display', status: 'done' },
  'scroll-area': { family: 'data-display', status: 'done' },
  chart: { family: 'data-display', status: 'in-progress' },

  // Feedback
  alert: { family: 'feedback', status: 'done' },
  sonner: { family: 'feedback', status: 'done' },
  skeleton: { family: 'feedback', status: 'done' },
  spinner: { family: 'feedback', status: 'done' },
  progress: { family: 'feedback', status: 'done' },

  // Date & layout
  calendar: { family: 'date-layout', status: 'done' },
  resizable: { family: 'date-layout', status: 'done' },
  direction: { family: 'date-layout', status: 'done' },
};
