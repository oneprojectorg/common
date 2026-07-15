import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The custom type tokens must be registered with their real class groups:
// stock twMerge can't tell `text-title` from a text color (dropping the size
// whenever a `text-{color}` class appears in the same merge), and it treats
// `font-strong` as a font family, so `font-normal` never displaces it.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-label',
        'text-title',
        'text-headline',
        'text-display',
      ],
      'font-weight': ['font-strong'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
