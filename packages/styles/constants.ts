export const screens = {
  xxs: '320px', // 20rem
  xs: '480px', // 30rem
  sm: '640px', // 40rem
  md: '768px', // 48rem
  lg: '1024px', // 64rem
  xl: '1280px', // 80rem
  xxl: '1536px', // 96rem
};

/**
 * OP Brand Colors as hex values.
 * Derived from the HSL tokens in tokens.css — use these in JS/TS contexts
 * (email configs, constants) where CSS custom properties aren't available.
 *
 * Semantic names match the Tailwind classes in shared-styles.css
 * (e.g. `neutral-charcoal` → `text-neutral-charcoal`).
 */
export const opColors = {
  white: '#FFFFFF',
  neutral: {
    offWhite: '#F9FAFA', // --op-neutral-50 (whiteish)
    gray1: '#EDEEEE', // --op-neutral-200
    gray2: '#CFD2D3', // --op-neutral-400 (lightGray)
    gray3: '#AAB0B1', // --op-neutral-500 (midGray)
    gray4: '#606A6C', // --op-neutral-700 (darkGray)
    charcoal: '#3A4649', // --op-neutral-900
    black: '#132225', // --op-neutral-950
  },
  primary: {
    teal: '#0396A6', // --op-teal-500
    tealWhite: '#F4FBFB', // --op-teal-white
    tealBlack: '#057D8A', // --op-teal-600
    yellow: '#F09E05', // --op-yellow-500
    orange1: '#F09E05', // --op-orange1-500
    orange2: '#F07305', // --op-orange2-500
  },
  functional: {
    red: '#F04405', // --op-red-500
    green: '#3DC200', // --op-green-500
    statusGreen: '#35A800', // --op-status-green
  },
} as const;
