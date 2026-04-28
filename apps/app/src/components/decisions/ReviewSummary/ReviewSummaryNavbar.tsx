'use client';

import { LuArrowLeft } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

export function ReviewSummaryNavbar({
  decisionSlug,
}: {
  decisionSlug: string;
}) {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b bg-white px-6 md:px-8">
      <Link
        href={`/decisions/${decisionSlug}`}
        className="flex items-center gap-2 text-base text-primary-teal"
      >
        <LuArrowLeft className="size-4" />
        {t('Back')}
      </Link>
    </header>
  );
}
