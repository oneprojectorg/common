import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Moved to @op/styles/constants so non-@op/ui consumers (e.g. the sense
// stories) can share them; re-exported here for existing importers.
export {
  GRADIENT_COLORS,
  GRADIENTS,
  getAvatarColorForString,
  getGradientForString,
} from '@op/styles/constants';

export * from 'tailwind-variants';
export { formatFileSize } from '../utils/file';
