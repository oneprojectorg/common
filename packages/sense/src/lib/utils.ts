import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The custom type tokens must be registered with their real class groups:
// stock twMerge can't tell `text-title` from a text color (dropping the size
// whenever a `text-{color}` class appears in the same merge), and it treats
// `font-strong` as a font family, so `font-normal` never displaces it.
//
// `max-h` needs both our own `max-h-dialog` and upstream's `max-h-none`, which
// tailwind-merge omits from that group (it has it for `max-w`). Unregistered,
// neither displaces a numeric `max-h-*` — both classes survive the merge and
// whichever CSS emits later silently wins.
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
      'max-h': ['max-h-dialog', 'max-h-none'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
