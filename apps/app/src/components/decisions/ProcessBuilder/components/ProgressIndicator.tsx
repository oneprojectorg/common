'use client';

import { Progress } from '@op/sense/Progress';

import { useTranslations } from '@/lib/i18n';

export function ProgressIndicator({
  percentage,
  variant,
}: {
  percentage: number;
  variant: 'bar' | 'strip';
}) {
  const t = useTranslations();
  const clamped = Math.min(100, Math.max(0, percentage));
  const label = t('{count}% complete', { count: clamped });

  // Progress owns role="progressbar" and the aria-value* attributes, so the
  // only thing left to supply is the accessible name.
  if (variant === 'strip') {
    return (
      <Progress
        value={clamped}
        aria-label={label}
        className="absolute inset-x-0 top-0 md:hidden"
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-160 items-center gap-4">
      <Progress value={clamped} aria-label={label} className="flex-1" />
      <span
        className={
          clamped === 100
            ? 'shrink-0 text-base text-primary'
            : 'shrink-0 text-base text-foreground'
        }
      >
        {label}
      </span>
    </div>
  );
}
