// Shared decorator for the first-class @op/sense stories. Scopes every story
// in the `.sense` theme class so sense's semantic CSS variables apply.
//
// Portaled content (dialogs, menus, tooltips, toasts…) renders outside this
// wrapper, so those stories must also pass `className="sense"` to the
// portaled part — see Dialog.stories.tsx for the pattern.
//
// These stories live in `stories-sense/`, deliberately separate from
// `stories/` (@op/ui): they only import from `@op/sense/*`, so when @op/ui is
// deleted and Storybook moves out, this directory moves with it unchanged.

import type { Decorator } from '@storybook/react-vite';

export const withSense: Decorator = (Story) => (
  <div className="sense p-8">
    <Story />
  </div>
);
