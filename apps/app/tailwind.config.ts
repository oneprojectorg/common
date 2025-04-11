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
      fontSize: {
        header: [
          '1rem',
          {
            lineHeight: '1.6',
            letterSpacing: '-0.01em',
            fontWeight: '300',
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
      colors: {
        teal: {
          DEFAULT: 'hsl(var(--op-teal-500))',
          50: 'hsl(var(--op-teal-50))',
          100: 'hsl(var(--op-teal-100))',
          200: 'hsl(var(--op-teal-200))',
          300: 'hsl(var(--op-teal-300))',
          400: 'hsl(var(--op-teal-400))',
          500: 'hsl(var(--op-teal-500))',
          600: 'hsl(var(--op-teal-600))',
          700: 'hsl(var(--op-teal-700))',
          800: 'hsl(var(--op-teal-800))',
          900: 'hsl(var(--op-teal-900))',
          950: 'hsl(var(--op-teal-950))',
        },
        yellow: {
          DEFAULT: 'hsl(var(--op-yellow-500))',
          50: 'hsl(var(--op-yellow-50))',
          100: 'hsl(var(--op-yellow-100))',
          200: 'hsl(var(--op-yellow-200))',
          300: 'hsl(var(--op-yellow-300))',
          400: 'hsl(var(--op-yellow-400))',
          500: 'hsl(var(--op-yellow-500))',
          600: 'hsl(var(--op-yellow-600))',
          700: 'hsl(var(--op-yellow-700))',
          800: 'hsl(var(--op-yellow-800))',
          900: 'hsl(var(--op-yellow-900))',
          950: 'hsl(var(--op-yellow-950))',
        },
        orange1: {
          DEFAULT: 'hsl(var(--op-orange1-500))',
          50: 'hsl(var(--op-orange1-50))',
          100: 'hsl(var(--op-orange1-100))',
          200: 'hsl(var(--op-orange1-200))',
          300: 'hsl(var(--op-orange1-300))',
          400: 'hsl(var(--op-orange1-400))',
          500: 'hsl(var(--op-orange1-500))',
          600: 'hsl(var(--op-orange1-600))',
          700: 'hsl(var(--op-orange1-700))',
          800: 'hsl(var(--op-orange1-800))',
          900: 'hsl(var(--op-orange1-900))',
          950: 'hsl(var(--op-orange1-950))',
        },
        orange2: {
          DEFAULT: 'hsl(var(--op-orange2-500))',
          50: 'hsl(var(--op-orange2-50))',
          100: 'hsl(var(--op-orange2-100))',
          200: 'hsl(var(--op-orange2-200))',
          300: 'hsl(var(--op-orange2-300))',
          400: 'hsl(var(--op-orange2-400))',
          500: 'hsl(var(--op-orange2-500))',
          600: 'hsl(var(--op-orange2-600))',
          700: 'hsl(var(--op-orange2-700))',
          800: 'hsl(var(--op-orange2-800))',
          900: 'hsl(var(--op-orange2-900))',
          950: 'hsl(var(--op-orange2-950))',
        },
        red: {
          DEFAULT: 'hsl(var(--op-red-500))',
          50: 'hsl(var(--op-red-50))',
          100: 'hsl(var(--op-red-100))',
          200: 'hsl(var(--op-red-200))',
          300: 'hsl(var(--op-red-300))',
          400: 'hsl(var(--op-red-400))',
          500: 'hsl(var(--op-red-500))',
          600: 'hsl(var(--op-red-600))',
          700: 'hsl(var(--op-red-700))',
          800: 'hsl(var(--op-red-800))',
          900: 'hsl(var(--op-red-900))',
          950: 'hsl(var(--op-red-950))',
        },

        black: 'hsl(var(--op-neutral-950))',
        charcoal: 'hsl(var(--op-neutral-900))',
        darkGray: 'hsl(var(--op-neutral-700))',
        midGray: 'hsl(var(--op-neutral-500))',
        lightGray: 'hsl(var(--op-neutral-400))',
        offWhite: 'hsl(var(--op-neutral-200))',
        whiteish: 'hsl(var(--op-neutral-50:))',
        white: 'hsl(var(--op-white))',
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
