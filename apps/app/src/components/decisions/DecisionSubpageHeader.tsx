import type { ReactNode } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { ButtonLink } from '../ButtonLink';

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
      <ButtonLink href={backHref} variant="link">
        <LuArrowLeft className="size-4 rtl:-scale-x-100" />
        {backLabel}
      </ButtonLink>
      {children}
    </header>
  );
}
