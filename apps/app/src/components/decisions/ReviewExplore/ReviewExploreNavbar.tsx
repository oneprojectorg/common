'use client';

import { Button } from '@op/ui/Button';
import { cn } from '@op/ui/utils';
import { LuChevronRight, LuList } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { LocaleChooser } from '@/components/LocaleChooser';
import { UserAvatarMenu } from '@/components/SiteHeader';

interface ReviewExploreNavbarProps {
  slug: string;
  proposalName: string;
  isProposalListOpen: boolean;
  onOpenProposalList: () => void;
}

export function ReviewExploreNavbar({
  slug,
  proposalName,
  isProposalListOpen,
  onOpenProposalList,
}: ReviewExploreNavbarProps) {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b bg-white px-6 md:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={`/decisions/${slug}`}
          className="shrink-0 text-base text-primary-teal"
        >
          {t('All proposals')}
        </Link>
        <LuChevronRight className="size-4 shrink-0 text-midGray" />
        <Button
          unstyled
          onPress={onOpenProposalList}
          className={cn(
            'flex items-center gap-2 rounded px-2 py-1 text-base text-primary-teal',
            isProposalListOpen && 'bg-primary-tealWhite',
            !isProposalListOpen && 'sm:bg-primary-tealWhite',
            'sm:px-3 sm:py-2',
          )}
        >
          <LuList className="size-4 shrink-0" />
          <span className="truncate">{proposalName}</span>
        </Button>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <LocaleChooser />
        <UserAvatarMenu className="hidden sm:block" />
      </div>
    </header>
  );
}
