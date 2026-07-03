import { commonColors } from '@op/core';
import { pixelBasedPreset, type TailwindConfig } from 'react-email';

export default {
  // Email clients don't support `rem`; this preset rebases Tailwind's scale on
  // pixels (16px/4px) so utilities render consistently across clients.
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        neutral: {
          ...commonColors,
          charcoal: '#3A4649',
          gray1: '#EDEEEE',
          gray4: '#606A6C',
        },
        primary: {
          teal: '#387582',
        },
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
      xs: ['10px', { lineHeight: '15px' }],
      sm: ['12px', { lineHeight: '18px' }],
      base: ['14px', { lineHeight: '20px' }],
      lg: ['16px', { lineHeight: '24px' }],
      xl: ['18px', { lineHeight: '28px' }],
      '2xl': ['24px', { lineHeight: '32px' }],
      '3xl': ['30px', { lineHeight: '36px' }],
      '4xl': ['36px', { lineHeight: '36px' }],
      '5xl': ['48px', { lineHeight: '1' }],
      '6xl': ['60px', { lineHeight: '1' }],
      '7xl': ['72px', { lineHeight: '1' }],
      '8xl': ['96px', { lineHeight: '1' }],
      '9xl': ['144px', { lineHeight: '1' }],
    },
  },
} satisfies TailwindConfig;
