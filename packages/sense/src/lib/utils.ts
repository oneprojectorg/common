import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The custom type-scale tokens must be registered as font-size classes:
// stock twMerge can't tell `text-title` from a text color, so it would drop
// the size whenever a `text-{color}` class appears in the same merge.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-label',
        'text-title',
        'text-headline',
        'text-display',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
