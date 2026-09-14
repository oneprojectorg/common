'use client';

import { useTranslations } from '@/lib/i18n';

interface AverageScoreBarProps {
  averageScore: number;
  totalPoints: number;
}

export function AverageScoreBar({
  averageScore,
  totalPoints,
}: AverageScoreBarProps) {
  const t = useTranslations();
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted p-4">
      {/* No colour class: the label's Figma colour is gray-700, which is the
          body default, and no semantic token maps to that step. */}
      <span className="text-base font-strong">{t('Average score:')}</span>
      <span className="font-serif text-title text-foreground">
        {String(Math.round(averageScore))}
        <span className="text-muted-foreground">
          /{t('{pts} points', { pts: totalPoints })}
        </span>
      </span>
    </div>
  );
}
