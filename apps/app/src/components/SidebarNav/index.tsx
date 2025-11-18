'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { Sidebar, useSidebar } from '@op/ui/Sidebar';
import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';
import { usePress } from 'react-aria';
import { LuHouse, LuMessageCircle, LuUsers } from 'react-icons/lu';

import { Link, usePathname } from '@/lib/i18n';

export const SidebarNav = () => {
  const pathname = usePathname();
  const isSidebarEnabled = useFeatureFlag('sidebar_enabled');

  if (!isSidebarEnabled) {
    return null;
  }

  return (
    <Sidebar className="border-r" label="Navigation">
      <nav className="flex flex-col gap-1 p-4">
        <NavLink href="/" active={pathname === '/'}>
          <LuHouse className="size-4" /> Home
        </NavLink>
        <NavLink href="/org" active={pathname.startsWith('/org')}>
          <LuUsers className="size-4" /> Organizations
        </NavLink>
        <NavLink href="/processes" active={pathname.startsWith('/processes')}>
          <LuMessageCircle className="size-4" /> Processes
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
        'flex items-center gap-2 rounded-sm p-3 hover:bg-neutral-offWhite hover:no-underline',
        active && 'bg-neutral-offWhite/50',
      )}
      {...pressProps}
    >
      {children}
    </Link>
  );
};
