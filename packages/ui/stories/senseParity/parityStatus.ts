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
  input: { family: 'form-inputs', status: 'todo' },
  textarea: { family: 'form-inputs', status: 'todo' },
  field: { family: 'form-inputs', status: 'todo' },
  label: { family: 'form-inputs', status: 'todo' },
  checkbox: { family: 'form-inputs', status: 'todo' },
  'input-group': { family: 'form-inputs', status: 'todo' },
  'radio-group': { family: 'form-inputs', status: 'todo' },
  switch: { family: 'form-inputs', status: 'todo' },
  slider: { family: 'form-inputs', status: 'todo' },
  select: { family: 'form-inputs', status: 'todo' },
  'native-select': { family: 'form-inputs', status: 'todo' },
  combobox: { family: 'form-inputs', status: 'todo' },
  'input-otp': { family: 'form-inputs', status: 'todo' },

  // Buttons & toggles
  button: { family: 'buttons-toggles', status: 'todo' },
  'button-group': { family: 'buttons-toggles', status: 'todo' },
  toggle: { family: 'buttons-toggles', status: 'todo' },
  'toggle-group': { family: 'buttons-toggles', status: 'todo' },

  // Overlays
  dialog: { family: 'overlays', status: 'todo' },
  'alert-dialog': { family: 'overlays', status: 'todo' },
  sheet: { family: 'overlays', status: 'todo' },
  drawer: { family: 'overlays', status: 'todo' },
  popover: { family: 'overlays', status: 'todo' },
  tooltip: { family: 'overlays', status: 'todo' },
  'hover-card': { family: 'overlays', status: 'todo' },

  // Menus & navigation
  'dropdown-menu': { family: 'menus-navigation', status: 'todo' },
  'context-menu': { family: 'menus-navigation', status: 'todo' },
  menubar: { family: 'menus-navigation', status: 'todo' },
  'navigation-menu': { family: 'menus-navigation', status: 'todo' },
  breadcrumb: { family: 'menus-navigation', status: 'todo' },
  tabs: { family: 'menus-navigation', status: 'todo' },
  sidebar: { family: 'menus-navigation', status: 'todo' },
  pagination: { family: 'menus-navigation', status: 'todo' },
  command: { family: 'menus-navigation', status: 'todo' },

  // Data display
  table: { family: 'data-display', status: 'todo' },
  card: { family: 'data-display', status: 'todo' },
  badge: { family: 'data-display', status: 'todo' },
  avatar: { family: 'data-display', status: 'todo' },
  accordion: { family: 'data-display', status: 'todo' },
  collapsible: { family: 'data-display', status: 'todo' },
  separator: { family: 'data-display', status: 'todo' },
  item: { family: 'data-display', status: 'todo' },
  empty: { family: 'data-display', status: 'todo' },
  kbd: { family: 'data-display', status: 'todo' },
  'aspect-ratio': { family: 'data-display', status: 'todo' },
  carousel: { family: 'data-display', status: 'todo' },
  'scroll-area': { family: 'data-display', status: 'todo' },
  chart: { family: 'data-display', status: 'todo' },

  // Feedback
  alert: { family: 'feedback', status: 'todo' },
  sonner: { family: 'feedback', status: 'todo' },
  skeleton: { family: 'feedback', status: 'todo' },
  spinner: { family: 'feedback', status: 'todo' },
  progress: { family: 'feedback', status: 'todo' },

  // Date & layout
  calendar: { family: 'date-layout', status: 'todo' },
  resizable: { family: 'date-layout', status: 'todo' },
  direction: { family: 'date-layout', status: 'todo' },
};
