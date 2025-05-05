/* eslint-disable import/no-extraneous-dependencies */
import { commonColors } from '@op/core';
import tailwindContainerQueries from '@tailwindcss/container-queries';
import tailwindTypography from '@tailwindcss/typography';
import tailwindScrollbar from 'tailwind-scrollbar';
import type { Config } from 'tailwindcss';
import tailwindAnimate from 'tailwindcss-animate';
import tailwindReactAriaComponents from 'tailwindcss-react-aria-components';
import defaultTheme from 'tailwindcss/defaultTheme';

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
      fontSize: {
        'title-xxl': [
          '3rem',
          { lineHeight: '110%', fontWeight: '300', letterSpacing: '-0.075rem' },
        ],
        'title-xl': [
          '2.5rem',
          {
            lineHeight: '110%',
            fontWeight: '300',
            letterSpacing: '-0.0625rem',
          },
        ],
        'title-lg': [
          '1.75rem',
          {
            lineHeight: '110%',
            fontWeight: '300',
            letterSpacing: '-0.02625rem',
          },
        ],
        'title-md': [
          '1.5rem',
          {
            lineHeight: '110%',
            fontWeight: '300',
            letterSpacing: '-0.0225rem',
          },
        ],
        'title-base': [
          '1.25rem',
          {
            lineHeight: '110%',
            fontWeight: '300',
            letterSpacing: '-0.01875rem',
          },
        ],
        'title-sm': [
          '1rem',
          { lineHeight: '130%', fontWeight: '300', letterSpacing: '-0.015rem' },
        ],
        'title-xs': [
          '0.875rem',
          {
            lineHeight: '130%',
            fontWeight: '300',
            letterSpacing: '-0.01313rem',
          },
        ],
        'title-xxs': [
          '0.75rem',
          {
            lineHeight: '130%',
            fontWeight: '300',
            letterSpacing: '-0.01125rem',
          },
        ],
        'title-sm12': [
          '0.75rem',
          {
            lineHeight: '130%',
            fontWeight: '300',
            letterSpacing: '-0.01125rem',
          },
        ],
        xs: [
          '0.625rem',
          {
            lineHeight: '150%',
            fontWeight: '400',
          },
        ],
        sm: [
          '0.75rem',
          {
            lineHeight: '150%',
            fontWeight: '400',
          },
        ],
        base: [
          '0.875rem',
          {
            lineHeight: '150%',
            fontWeight: '400',
          },
        ],
        lg: [
          '1rem',
          {
            lineHeight: '150%',
            fontWeight: '400',
          },
        ],
      },
      size: {
        xs: {
          height: '0.75rem',
          lineHeight: '1.125rem',
        },
      },
      spacing: {
        18: '4.5rem',
      },
      colors: {
        accent: commonColors,
        border: 'hsl(var(--op-offWhite))',
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

        green: {
          DEFAULT: 'hsl(var(--op-green-500))',
        },
        black: 'hsl(var(--op-neutral-950))',
        charcoal: 'hsl(var(--op-neutral-900))',
        darkGray: 'hsl(var(--op-neutral-700))',
        midGray: 'hsl(var(--op-neutral-500))',
        lightGray: 'hsl(var(--op-neutral-400))',
        offWhite: 'hsl(var(--op-neutral-200))',
        whiteish: 'hsl(var(--op-neutral-50))',
        white: 'hsl(var(--op-white))',

        primary: {
          DEFAULT: 'hsl(var(--op-teal-500))',
          teal: 'hsl(var(--op-teal-500))',
          tealWhite: 'hsl(var(--op-teal-white))',
          tealBlack: 'hsl(var(--op-teal-600))',
          yellow: 'hsl(var(--op-yellow-500))',
          orange1: 'hsl(var(--op-orange1-500))',
          orange2: 'hsl(var(--op-orange2-500))',
        },
        neutral: {
          offWhite: 'hsl(var(--op-neutral-50))',
          gray1: 'hsl(var(--op-neutral-200))',
          gray2: 'hsl(var(--op-neutral-400))',
          gray3: 'hsl(var(--op-neutral-500))',
          gray4: 'hsl(var(--op-neutral-700))',
          charcoal: 'hsl(var(--op-neutral-900))',
          black: 'hsl(var(--op-neutral-950))',
        },
        functional: {
          red: 'hsl(var(--op-red-500))',
          redBlack: 'hsl(var(--op-red-600))',
          redWhite: 'hsl(var(--op-red-50))',
          green: 'hsl(var(--op-green-500))',
        },
        data: {
          purple: 'hsl(var(--op-purple-500))',
          blue: 'hsl(var(--op-blue-500))',
        },
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '0.5rem',
        md: '0.5rem',
        // sm: 'calc(var(--radius) - 0.25rem)',
        sm: '0.5rem',
      },
      boxShadow: {
        DEFAULT: '0px 0px 48px 0px rgba(20, 35, 38, 0.08)',
        light: '0px 0px 16px 0px rgba(20, 35, 38, 0.04)',
        md: '0px 0px 48px 0px rgba(20, 35, 38, 0.08)',
        green: '0px 0px 48px 0px rgba(193, 255, 173, 0.88)',
        orange: '0px 0px 48px 0px rgba(242, 183, 5, 0.64)',
      },
      backgroundImage: {
        gradient:
          'radial-gradient(154% 99.31% at 0% 0%, #3EC300 0%, #0396A6 51.56%)',
        tealGreen:
          'radial-gradient(154% 99.31% at 0% 0%, #3EC300 0%, #0396A6 51.56%)',
        redTeal:
          'radial-gradient(96.92% 140.1% at 72.02% 100%, #0396A6 0%, #FF613D 92.19%, #FFFBFA 99.99%)',
        orange:
          'radial-gradient(96.92% 140.1% at 72.02% 100%, #E35F00 0%, #DE8D00 48.44%, #FF9739 99.99%)',
        blueGreen:
          'radial-gradient(91.78% 91.78% at 89.17% 4.38%, #3EC300 0%, #0046C2 100%)',
        orangePurple:
          'radial-gradient(70.56% 70.56% at 72.75% 33.21%, #6200C3 0%, #FF613D 100%)',
        yellowOrange:
          'radial-gradient(74.88% 74.88% at 42.58% 76.89%, #F29F05 0%, #F2B705 100%))',
      },
      gridTemplateColumns: {
        '15': 'repeat(15, minmax(0, 1fr))',
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
