'use client';

import { Button } from '@op/ui/Button';
import { useSidebar } from '@op/ui/Sidebar';
import { cn } from '@op/ui/utils';
import { LuChevronRight, LuList } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { LocaleChooser } from '@/components/LocaleChooser';
import { UserAvatarMenu } from '@/components/SiteHeader';

interface ReviewExploreNavbarProps {
  slug: string;
}

export function ReviewExploreNavbar({ slug }: ReviewExploreNavbarProps) {
  const t = useTranslations();
  const { open, toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b bg-white">
      <div className="flex min-w-0 items-center gap-2 pl-4 md:pl-8">
        <Link
          href={`/decisions/${slug}`}
          className="shrink-0 text-base text-primary-teal"
        >
          {t('All proposals')}
        </Link>
        <LuChevronRight className="size-4 shrink-0 text-midGray" />
        <Button
          unstyled
          onPress={toggleSidebar}
          className={cn(
            'flex items-center gap-2 rounded px-2 py-1 text-base text-primary-teal',
            open && 'bg-primary-tealWhite',
          )}
        >
          <LuList className="size-4 shrink-0" />
          <span className="truncate">Community Garden Expansion</span>
        </Button>
      </div>
      <div className="flex shrink-0 items-center gap-3 pr-4 md:pr-8">
        <LocaleChooser />
        <UserAvatarMenu className="hidden sm:block" />
      </div>
    </header>
  );
}
