'use client';

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

  if (variant === 'strip') {
    return (
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={t('{count}% complete', { count: clamped })}
        className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-neutral-gray2 md:hidden"
      >
        <div
          className="h-full bg-linear-to-r from-functional-green to-primary-teal transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-160 items-center gap-4">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={t('{count}% complete', { count: clamped })}
        className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-gray2"
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-functional-green to-primary-teal transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span
        className={
          clamped === 100
            ? 'shrink-0 bg-linear-to-r from-functional-green to-primary-teal bg-clip-text text-base text-transparent'
            : 'shrink-0 text-base text-neutral-black'
        }
      >
        {t('{count}% complete', { count: clamped })}
      </span>
    </div>
  );
}
