import { withThemeByClassName } from '@storybook/addon-themes';
import { themes } from '@storybook/theming';

import type { Preview } from '@storybook/react';

import '../tailwind.styles.scss';
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
    Story => (
      <div className="font-sans">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      theme: themes.dark,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
