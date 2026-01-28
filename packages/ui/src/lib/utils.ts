import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Avatar gradient classes and their corresponding hex colors.
 * The hex color approximates the dominant visual color of each gradient
 * at small avatar sizes, used for cursor colors to match avatar appearance.
 */
export const AVATAR_COLORS = [
  { gradient: 'bg-gradient', hex: '#1fa88f' }, // teal-green (dominant at center)
  { gradient: 'bg-redTeal', hex: '#e86a4a' }, // coral-red (dominant color)
  { gradient: 'bg-blueGreen', hex: '#1a7ab8' }, // blue (dominant at center)
  { gradient: 'bg-orangePurple', hex: '#8b2db0' }, // purple-magenta (dominant)
] as const;

/** @deprecated Use AVATAR_COLORS instead */
export const GRADIENTS = AVATAR_COLORS.map((c) => c.gradient);

const getNumberFromHashedString = (name: string): number => {
  let hash = 0;
  if (name.length === 0) return hash;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash as number;
};

/**
 * Get a deterministic avatar color for a name.
 * Returns both the Tailwind gradient class and a hex color for cursors.
 */
export const getAvatarColorForString = (name: string) => {
  const hash = getNumberFromHashedString(name);
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] ?? AVATAR_COLORS[0];
};

/** @deprecated Use getAvatarColorForString instead */
export const getGradientForString = (name: string) => {
  return getAvatarColorForString(name).gradient;
};

export * from 'tailwind-variants';
