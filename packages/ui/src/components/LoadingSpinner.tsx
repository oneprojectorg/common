import { tv } from 'tailwind-variants';

import { cn } from '../lib/utils';

const spinnerVariants = tv({
  base: 'aspect-square h-full w-auto animate-spin',
  variants: {
    color: {
      gray: 'fill-offWhite text-neutral-gray4',
      teal: 'text-teal fill-teal-200',
    },
    size: {
      md: 'size-6',
    },
  },
  defaultVariants: {
    color: 'teal',
    size: 'md',
  },
});

export interface LoadingSpinnerProps {
  className?: string;
  color?: 'teal' | 'gray';
  size?: 'md';
}

export const LoadingSpinner = ({
  className,
  color,
  size,
}: LoadingSpinnerProps) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(spinnerVariants({ color, size }), className)}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 19.2277C16.0041 19.2277 19.25 15.9817 19.25 11.9777C19.25 7.9736 16.0041 4.72766 12 4.72766C7.99594 4.72766 4.75 7.9736 4.75 11.9777C4.75 15.9817 7.99594 19.2277 12 19.2277ZM12 21.2277C17.1086 21.2277 21.25 17.0863 21.25 11.9777C21.25 6.86903 17.1086 2.72766 12 2.72766C6.89137 2.72766 2.75 6.86903 2.75 11.9777C2.75 17.0863 6.89137 21.2277 12 21.2277Z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.1795 10.208C20.7311 10.1806 21.2005 10.6056 21.2279 11.1572C21.5463 17.5673 16.2381 21.788 11.1395 21.2215C10.5906 21.1605 10.1951 20.6661 10.2561 20.1172C10.3171 19.5683 10.8115 19.1728 11.3604 19.2338C15.2618 19.6672 19.4863 16.4089 19.2304 11.2564C19.203 10.7048 19.6279 10.2354 20.1795 10.208Z"
        fill="currentColor"
      />
    </svg>
  );
};
