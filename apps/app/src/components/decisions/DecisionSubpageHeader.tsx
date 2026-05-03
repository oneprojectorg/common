import type { ReactNode } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

interface DecisionSubpageHeaderProps {
  backHref: string;
  backLabel: ReactNode;
  children?: ReactNode;
}

export function DecisionSubpageHeader({
  backHref,
  backLabel,
  children,
}: DecisionSubpageHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b bg-white px-6 md:px-8">
      <Link
        href={backHref}
        className="flex items-center gap-2 text-base text-primary-teal"
      >
        <LuArrowLeft className="size-4" />
        {backLabel}
      </Link>
      {children}
    </header>
  );
}
