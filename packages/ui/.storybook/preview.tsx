import '@op/styles';
import { withThemeByClassName } from '@storybook/addon-themes';
import type { Preview } from '@storybook/react-vite';
import { themes } from 'storybook/theming';

import '../stories/index.css';

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
      <div className="font-sans">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      theme: themes.light,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      // Sort the @op/ui ↔ @op/sense migration surface to the top so it's
      // easy to find; everything else stays in default alphabetical order.
      storySort: {
        order: ['Sense', ['Primitives', 'Composites'], 'Sense Comparison', '*'],
      },
    },
  },
};

export default preview;
