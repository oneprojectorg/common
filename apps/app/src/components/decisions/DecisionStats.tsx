import { Separator } from '@op/sense/Separator';
import { ReactNode } from 'react';

/**
 * Row of hero-banner stats. Text takes the colour of the banner. The padding
 * adds to the banner's `gap-4`, for the 32px the design puts above and below.
 */
export function DecisionStats({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-2 py-4 xxs:flex-row xxs:gap-4">
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
    <div className="flex min-w-24 flex-col items-center gap-2 sm:min-w-40">
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
      className="hidden h-5 bg-current/50 xxs:block data-vertical:self-center"
    />
  );
}
