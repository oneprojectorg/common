import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * aria attributes tying a control in its validation-error state to the
 * element that describes the error. Spread onto the interactive element
 * (or a TipTap `editorProps.attributes` object); empty when valid.
 */
export function getInvalidAriaAttributes({
  isInvalid,
  errorMessageId,
}: {
  isInvalid: boolean;
  errorMessageId?: string;
}): { 'aria-invalid'?: 'true'; 'aria-describedby'?: string } {
  if (!isInvalid) {
    return {};
  }
  return {
    'aria-invalid': 'true',
    ...(errorMessageId ? { 'aria-describedby': errorMessageId } : {}),
  };
}

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
  return hash as number;
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

export * from 'tailwind-variants';
export { formatFileSize } from '../utils/file';
