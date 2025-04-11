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
        primary: 'hsl(var(--color-op-teal))',
        // border: 'hsl(var(--border))',
        // input: 'hsl(var(--input))',
        // ring: 'hsl(var(--ring))',
        background: 'hsl(var(--color-op-whiteish))',
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
      },
      backgroundImage: {
        'stepper-gradient':
          'radial-gradient(154% 99.31% at 0% 0%, #3EC300 0%, #0396A6 51.56%)',
        'background-gradient':
          'radial-gradient(85.55% 132.88% at 50% 100%, var(--color-op-teal) 0%, var(--color-op-whiteish) 100%);',
      },
      //   borderRadius: {
      //     lg: 'var(--radius)',
      //     md: 'calc(var(--radius) - 0.125rem)',
      //     sm: 'calc(var(--radius) - 0.25rem)',
      //   },
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
