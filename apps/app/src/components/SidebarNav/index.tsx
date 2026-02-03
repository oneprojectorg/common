'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { Sidebar, useSidebar } from '@op/ui/Sidebar';
import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';
import { usePress } from 'react-aria';
import { LuHouse, LuUsers } from 'react-icons/lu';

import { Link, usePathname, useTranslations } from '@/lib/i18n';

export const SidebarNav = () => {
  const t = useTranslations();
  const pathname = usePathname();
  const decisionsTabEnabled = useFeatureFlag('decisions_tab_enabled');

  return (
    <Sidebar className="border-r" label="Navigation">
      <nav className="flex flex-col gap-1 p-4">
        <NavLink href="/" active={pathname === '/'}>
          <LuHouse className="size-4" /> {t('Home')}
        </NavLink>
        <NavLink href="/org" active={pathname.startsWith('/org')}>
          <LuUsers className="size-4" /> {t('Organizations')}
        </NavLink>
        {decisionsTabEnabled && (
          <NavLink href="/decisions" active={pathname.startsWith('/decisions')}>
            <LuUsers className="size-4" /> {t('Decisions')}
          </NavLink>
        )}
      </nav>
    </Sidebar>
  );
};

const NavLink = ({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) => {
  const { toggleSidebar, isMobile } = useSidebar();
  const { pressProps } = usePress({
    onPress: isMobile ? toggleSidebar : undefined,
  });
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-sm p-3 hover:bg-neutral-offWhite hover:no-underline',
        active && 'bg-neutral-offWhite/50',
      )}
      {...pressProps}
    >
      {children}
    </Link>
  );
};
