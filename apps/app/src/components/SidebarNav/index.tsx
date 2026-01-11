'use client';

import { Sidebar, useSidebar } from '@op/ui/Sidebar';
import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';
import { usePress } from 'react-aria';
import { LuHouse, LuUsers } from 'react-icons/lu';

import { Link, usePathname, useTranslations } from '@/lib/i18n';

export const SidebarNav = () => {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <Sidebar className="border-r border-neutral-gray1" label="Navigation">
      <nav className="gap-1 p-4 flex flex-col">
        <NavLink href="/" active={pathname === '/'}>
          <LuHouse className="size-4" /> {t('Home')}
        </NavLink>
        <NavLink href="/org" active={pathname.startsWith('/org')}>
          <LuUsers className="size-4" /> {t('Organizations')}
        </NavLink>
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
        'gap-2 p-3 flex items-center rounded-sm hover:bg-neutral-offWhite hover:no-underline',
        active && 'bg-neutral-offWhite/50',
      )}
      {...pressProps}
    >
      {children}
    </Link>
  );
};
