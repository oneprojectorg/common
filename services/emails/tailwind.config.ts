import { opColors } from '@op/styles/constants';
import type { TailwindConfig } from '@react-email/tailwind';

export default {
  theme: {
    extend: {
      colors: {
        neutral: opColors.neutral,
        primary: opColors.primary,
        functional: opColors.functional,
      },
    },
    fontFamily: {
      sans: [
        'Roboto',
        'Helvetica Neue',
        'Helvetica',
        'Arial',
        'Verdana',
        'ui-sans-serif',
        'system-ui',
        'sans-serif',
        'Apple Color Emoji',
        'Segoe UI Emoji',
        'Segoe UI Symbol',
        'Noto Color Emoji',
      ],
      serif: [
        'Roboto Serif',
        'ui-serif',
        'Georgia',
        'Cambria',
        'Times New Roman',
        'Times',
        'serif',
      ],
      mono: [
        'Roboto Mono',
        'ui-monospace',
        'SFMono-Regular',
        'Menlo',
        'Monaco',
        'Consolas',
        'Liberation Mono',
        'Courier New',
        'monospace',
      ],
    },
    fontSize: {
      xs: ['12px', { lineHeight: '16px' }],
      sm: ['14px', { lineHeight: '20px' }],
      base: ['16px', { lineHeight: '24px' }],
      lg: ['18px', { lineHeight: '28px' }],
      xl: ['20px', { lineHeight: '28px' }],
      '2xl': ['24px', { lineHeight: '32px' }],
      '3xl': ['30px', { lineHeight: '36px' }],
      '4xl': ['36px', { lineHeight: '36px' }],
      '5xl': ['48px', { lineHeight: '1' }],
      '6xl': ['60px', { lineHeight: '1' }],
      '7xl': ['72px', { lineHeight: '1' }],
      '8xl': ['96px', { lineHeight: '1' }],
      '9xl': ['144px', { lineHeight: '1' }],
      'title-lg': [
        '28px',
        { lineHeight: '110%', fontWeight: '300', letterSpacing: '-0.02625rem' },
      ],
    },
  },
} satisfies TailwindConfig;
