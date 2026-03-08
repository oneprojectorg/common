'use client';

import { useTranslations } from '@/lib/i18n';

const GRADIENT = 'linear-gradient(to right, #3EC300, #0396A6)';

export function ProgressIndicator({
  percentage,
  variant,
}: {
  percentage: number;
  variant: 'bar' | 'strip';
}) {
  const t = useTranslations();

  if (variant === 'strip') {
    return (
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-neutral-gray2 md:hidden">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${percentage}%`, backgroundImage: GRADIENT }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-160 items-center gap-4">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-gray2">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%`, backgroundImage: GRADIENT }}
        />
      </div>
      <span
        className="shrink-0 bg-clip-text text-base text-transparent"
        style={{ backgroundImage: GRADIENT }}
      >
        {t('{count}% complete', { count: percentage })}
      </span>
    </div>
  );
}
