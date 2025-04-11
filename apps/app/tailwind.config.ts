import defaultTheme from 'tailwindcss/defaultTheme';

import sharedConfig from '@op/ui/tailwind-config';
// @ts-ignore ignore undeclared types
import { withUITailwindPreset } from '@op/ui/tailwind-utils';

import type { Config } from 'tailwindcss';

const config: Pick<Config, 'content' | 'theme' | 'presets'> = {
  content: ['./app/**/*.tsx', './components/**/*.tsx', './flow/**/*.tsx'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-mono)', ...defaultTheme.fontFamily.mono],
      },
      borderRadius: {
        ...defaultTheme.borderRadius,
        xs: '0.125rem',
        sm: '0.25rem',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        sweep: {
          '0%, 100%': { backgroundPosition: '0% 0%' },
          '50%': { backgroundPosition: '100% 100%' },
        },
      },
      colors: {
        primary: 'hsl(var(--color-op-teal))',
        background: 'hsl(var(--color-op-whiteish))',
      },
      backgroundImage: {
        'aside-gradient':
          'radial-gradient(154% 99.31% at 0% 0%, #3EC300 0%, #0396A6 51.56%)',
      },
    },
  },
  presets: [sharedConfig],
};

export default withUITailwindPreset(config);
