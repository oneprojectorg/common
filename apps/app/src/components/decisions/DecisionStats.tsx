import { Separator } from '@op/sense/Separator';
import { ReactNode } from 'react';

/**
 * Row of hero-banner stats. Text takes the colour of the banner. The padding
 * adds to the banner's `gap-4`, for the 32px the design puts above and below.
 * Below `sm` the stats take half the row each, so a third wraps under the
 * first two instead of overflowing a phone screen.
 */
export function DecisionStats({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-y-4 py-4 sm:flex-nowrap sm:gap-4">
      {children}
    </div>
  );
}

export function DecisionStat({
  value,
  label,
}: {
  value: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="flex w-1/2 flex-col items-center gap-2 sm:w-auto sm:min-w-40">
      <div className="flex items-center justify-center font-serif text-headline font-light">
        {value}
      </div>
      <div className="flex items-center justify-center text-center text-sm">
        {label}
      </div>
    </div>
  );
}

export function DecisionStatDivider() {
  return (
    <Separator
      orientation="vertical"
      aria-hidden="true"
      className="hidden h-5 bg-current/50 sm:block data-vertical:self-center"
    />
  );
}
