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
    <div className="flex items-center justify-between rounded-lg bg-neutral-offWhite p-4">
      <span className="font-serif text-title-sm text-neutral-black">
        {t('Average Score')}
      </span>
      <span className="font-serif text-title-sm text-neutral-black">
        {formatScore(averageScore)}
        <span className="text-neutral-gray4">/{totalPoints}pts</span>
      </span>
    </div>
  );
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}
