import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const GRADIENT_COLORS = [
  { gradient: 'bg-gradient', hex: '#1fa88f' },
  { gradient: 'bg-redTeal', hex: '#e86a4a' },
  { gradient: 'bg-blueGreen', hex: '#1a7ab8' },
  { gradient: 'bg-orangePurple', hex: '#8b2db0' },
] as const;

export const GRADIENTS = GRADIENT_COLORS.map((c) => c.gradient);

function hash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export function getAvatarColorForString(name: string) {
  const i = Math.abs(hash(name)) % GRADIENT_COLORS.length;
  return GRADIENT_COLORS[i] ?? GRADIENT_COLORS[0];
}

export function getGradientForString(name: string) {
  return getAvatarColorForString(name).gradient;
}
