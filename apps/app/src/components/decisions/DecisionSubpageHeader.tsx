import type { ReactNode } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { ButtonLink } from '../ButtonLink';
import { LocaleChooser } from '../LocaleChooser';

interface DecisionSubpageHeaderProps {
  backHref: string;
  backLabel: ReactNode;
  /** Page actions for the end of the bar, before the locale chooser. */
  children?: ReactNode;
  /** Account menu. Rendered last, after the locale chooser. */
  accountSlot?: ReactNode;
}

export function DecisionSubpageHeader({
  backHref,
  backLabel,
  children,
  accountSlot,
}: DecisionSubpageHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b bg-white px-6 md:px-8">
      <ButtonLink href={backHref} variant="link">
        <LuArrowLeft className="size-4 rtl:-scale-x-100" />
        {backLabel}
      </ButtonLink>
      {/* The chooser lives here rather than in each caller so every decision
          subpage gets it. Order matches DecisionInstanceHeader and
          ProposalEditorHeader: page actions, locale, then the account menu. */}
      <div className="flex items-center gap-4">
        {children}
        <LocaleChooser />
        {accountSlot}
      </div>
    </header>
  );
}
