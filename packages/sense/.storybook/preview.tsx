import '@op/styles';
import { withThemeByClassName } from '@storybook/addon-themes';
import type { Preview } from '@storybook/react-vite';
import { themes } from 'storybook/theming';

import './fonts.css';

const preview: Preview = {
  decorators: [
    withThemeByClassName({
      themes: {
        light: 'light',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
    (Story) => (
      <div className="p-8 font-sans">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      theme: themes.light,
    },
    a11y: {
      // Reported in the A11y panel, not yet enforced: the CI gate
      // (@storybook/addon-vitest) is blocked on an upstream Vite/ESM break
      // between @testing-library/dom and aria-query@5.3.0. Flip to 'error'
      // when that lands, and let a story with known debt opt down to 'todo'
      // with a comment naming the rule — the same punch-list model
      // tests/e2e/a11y-baseline uses for routes.
      test: 'todo',
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: ['Primitives', 'Composites', '*'],
      },
    },
  },
};

export default preview;
