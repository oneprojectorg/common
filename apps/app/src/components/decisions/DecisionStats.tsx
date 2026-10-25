import { ReactNode } from 'react';

/** Row of hero-banner stats. Text takes the colour of the banner. */
export function DecisionStats({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-2 xxs:flex-row sm:gap-6">
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
    <div className="flex min-w-24 flex-col items-center gap-2">
      <div className="flex items-center justify-center font-serif text-headline">
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
    <hr
      aria-hidden="true"
      className="hidden h-8 w-0.5 border-0 bg-current/50 xxs:block"
    />
  );
}
