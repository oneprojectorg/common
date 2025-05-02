import sharedConfig from '@op/ui/tailwind-config';
// @ts-ignore ignore undeclared types
import { withUITailwindPreset } from '@op/ui/tailwind-utils';
import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Pick<Config, 'content' | 'theme' | 'presets'> = {
  content: [
    './src/app/**/*.tsx',
    './src/components/**/*.tsx',
    './src/flow/**/*.tsx',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-mono)', ...defaultTheme.fontFamily.mono],
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
    },
  },
  presets: [sharedConfig],
};

export default withUITailwindPreset(config);
