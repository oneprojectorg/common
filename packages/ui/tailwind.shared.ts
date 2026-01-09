/**
 * @deprecated This file is deprecated. Tailwind v4 uses CSS-based configuration.
 * The theme configuration has been migrated to @op/brand/shared-styles.css
 *
 * This file is kept only for backwards compatibility with any legacy imports.
 * For new code, import theme values from CSS custom properties or use the
 * Tailwind v4 CSS-based configuration system.
 */

// Minimal config export for backwards compatibility
export const config = {
  darkMode: ['class', 'data-theme'],
  theme: {
    screens: {
      xxs: '320px',
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
  },
} as const;

export default config;
