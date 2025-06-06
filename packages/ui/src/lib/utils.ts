import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const GRADIENTS = [
  'bg-gradient',
  'bg-tealGreen',
  'bg-redTeal',
  'bg-blueGreen',
  'bg-orangePurple',
];

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

export const getGradientForString = (name: string) => {
  const hash = getNumberFromHashedString(name);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
};

export * from 'tailwind-variants';
