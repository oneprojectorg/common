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
 * Convert an HSL triplet (matching the format in tokens.css) to a hex string.
 * H is in degrees [0, 360), S and L are percentages [0, 100].
 */
function hsl(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;

  let r: number;
  let g: number;
  let b: number;

  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * OP Brand Colors — auto-converted from the HSL values in tokens.css.
 *
 * Update the HSL triplets here to match tokens.css; hex is computed
 * automatically so there's only one place to maintain color values.
 *
 * Semantic names match the Tailwind classes in shared-styles.css
 * (e.g. `neutral-charcoal` → `text-neutral-charcoal`).
 */
export const opColors = {
  white: '#FFFFFF',
  neutral: {
    offWhite: hsl(180, 11, 98), // --op-neutral-50 (whiteish)
    gray1: hsl(180, 3, 93), // --op-neutral-200
    gray2: hsl(195, 4, 82), // --op-neutral-400 (lightGray)
    gray3: hsl(189, 4, 68), // --op-neutral-500 (midGray)
    gray4: hsl(190, 6, 40), // --op-neutral-700 (darkGray)
    charcoal: hsl(191, 11, 26), // --op-neutral-900
    black: hsl(191, 32, 11), // --op-neutral-950
  },
  primary: {
    teal: hsl(186, 96, 33), // --op-teal-500
    tealWhite: hsl(180, 43, 97), // --op-teal-white
    tealBlack: hsl(186, 93, 28), // --op-teal-600
    yellow: hsl(39, 96, 48), // --op-yellow-500
    orange1: hsl(39, 96, 48), // --op-orange1-500
    orange2: hsl(28, 96, 48), // --op-orange2-500
  },
  functional: {
    red: hsl(16, 96, 48), // --op-red-500
    green: hsl(101, 100, 38), // --op-green-500
    statusGreen: hsl(101, 100, 33), // --op-status-green
  },
};
