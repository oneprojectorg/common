/* eslint-disable import/no-extraneous-dependencies */
import tailwindContainerQueries from '@tailwindcss/container-queries';
import tailwindTypography from '@tailwindcss/typography';
import tailwindScrollbar from 'tailwind-scrollbar';
import tailwindAnimate from 'tailwindcss-animate';
import tailwindReactAriaComponents from 'tailwindcss-react-aria-components';
import defaultTheme from 'tailwindcss/defaultTheme';

import { commonColors } from '@op/core';

import type { Config } from 'tailwindcss';

// This is the shared tailwind config that is used in packages, workshop, and web apps
const config: Omit<Config, 'content'> = {
  darkMode: ['class', 'data-theme'],
  theme: {
    screens: {
      xxs: '320px',
      xs: '480px',
      ...defaultTheme.screens,
    },
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        accent: ['var(--font-accent)', ...defaultTheme.fontFamily.sans],
        serif: ['var(--font-serif)', ...defaultTheme.fontFamily.serif],
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-mono)', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        accent: commonColors,
        // border: 'hsl(var(--border))',
        // input: 'hsl(var(--input))',
        // ring: 'hsl(var(--ring))',
        // background: 'hsl(var(--background))',
        // foreground: 'hsl(var(--foreground))',
        // primary: {
        //   DEFAULT: 'hsl(var(--primary))',
        //   foreground: 'hsl(var(--primary-foreground))',
        // },
        // secondary: {
        //   DEFAULT: 'hsl(var(--secondary))',
        //   foreground: 'hsl(var(--secondary-foreground))',
        // },
        // destructive: {
        //   DEFAULT: 'hsl(var(--destructive))',
        //   foreground: 'hsl(var(--destructive-foreground))',
        // },
        // muted: {
        //   DEFAULT: 'hsl(var(--muted))',
        //   foreground: 'hsl(var(--muted-foreground))',
        // },
        // accent: {
        //   DEFAULT: 'hsl(var(--accent))',
        //   foreground: 'hsl(var(--accent-foreground))',
        // },
        // popover: {
        //   DEFAULT: 'hsl(var(--popover))',
        //   foreground: 'hsl(var(--popover-foreground))',
        // },
        // card: {
        //   DEFAULT: 'hsl(var(--card))',
        //   foreground: 'hsl(var(--card-foreground))',
        // },
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
        whiteish: 'hsl(var(--op-neutral-50))',
        white: 'hsl(var(--op-white))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: '0.5rem',
        sm: 'calc(var(--radius) - 0.25rem)',
      },
    },
  },
  plugins: [
    tailwindScrollbar({
      nocompatible: true,
      preferredStrategy: 'pseudoelements',
    }),
    // This is patched for tailwindcss-animate to separate the animation duration from the transition duration
    tailwindAnimate,
    tailwindTypography,
    tailwindContainerQueries,
    tailwindReactAriaComponents,
  ],
  safelist: [
    // These are used in ScreenCapturer.tsx to temporarily hide the scrollbars
    '[&_.scroller]:!overflow-hidden',
    '[&_textarea]:!overflow-hidden',
  ],
};

export default config;
