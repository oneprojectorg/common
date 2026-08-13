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
 * Canonical heading class strings shared between the `Header1/2/3/4` components
 * in `@op/sense` and the TipTap rich text editor's `StyledHeading` extension.
 * Keeping these as literal Tailwind class strings ensures the build-time
 * scanner picks them up.
 */
/**
 * Avatar fallback gradients. The `gradient` values are Tailwind utility
 * classes defined in theme.css; the hex is a flat approximation for
 * contexts that can't use a class (e.g. remote cursors). Literal class
 * strings keep the build-time scanner happy.
 */
export const GRADIENT_COLORS = [
  { gradient: 'bg-gradient', hex: '#1fa88f' },
  { gradient: 'bg-redTeal', hex: '#e86a4a' },
  { gradient: 'bg-blueGreen', hex: '#1a7ab8' },
  { gradient: 'bg-orangePurple', hex: '#8b2db0' },
] as const;

export const GRADIENTS = GRADIENT_COLORS.map((c) => c.gradient);

const getNumberFromHashedString = (name: string): number => {
  let hash = 0;
  if (name.length === 0) return hash;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
};

/**
 * Get a deterministic avatar color for a name.
 * Returns both the Tailwind gradient class and a hex color for cursors.
 */
export const getAvatarColorForString = (name: string) => {
  const hash = getNumberFromHashedString(name);
  const index = Math.abs(hash) % GRADIENT_COLORS.length;
  return GRADIENT_COLORS[index] ?? GRADIENT_COLORS[0];
};

export const getGradientForString = (name: string) => {
  return getAvatarColorForString(name).gradient;
};

/**
 * Identical to the `Header1`–`Header4` components in `@op/sense/Header`, which
 * is the whole point of this object: the editor, the static renderer and the
 * components have to agree.
 *
 * `font-light` is explicit because the sense type steps bake no weight, where
 * the pre-sense `text-title-*` steps carried 300. No colour class — the base
 * layer already sets `color: var(--foreground)` on `:root`.
 */
export const headingClasses = {
  h1: 'font-serif text-display font-light',
  h2: 'font-serif text-headline font-light',
  h3: 'font-serif text-title',
  h4: 'font-serif text-label',
} as const;
