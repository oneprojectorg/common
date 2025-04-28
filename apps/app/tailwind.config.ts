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
      fontSize: {
        base: [
          '0.875rem',
          {
            lineHeight: '1.1375rem',
          },
        ],
        header: [
          '2rem',
          {
            lineHeight: '1.925rem',
            letterSpacing: '-0.02625rem',
            fontWeight: 300,
          },
        ],
        headerMobile: [
          '1.25rem',
          {
            lineHeight: '1.375rem',
            letterSpacing: '-0.01875rem',
            fontWeight: 300,
          },
        ],
      },
      borderRadius: {
        ...defaultTheme.borderRadius,
        xs: '0.125rem',
        sm: '0.1875rem',
        md: '0.5rem',
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
      boxShadow: {
        md: '0px 0px 16px 0px rgba(20, 35, 38, 0.04)',
        green: '0px 0px 48px 0px rgba(193, 255, 173, 0.88)',
      },
    },
  },
  presets: [sharedConfig],
};

export default withUITailwindPreset(config);
