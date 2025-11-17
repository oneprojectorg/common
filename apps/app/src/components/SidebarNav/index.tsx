'use client';

import { Sidebar, useSidebar } from '@op/ui/Sidebar';
import { cn } from '@op/ui/utils';
import { House, MessageCircle, Users } from 'lucide-react';
import { ReactNode } from 'react';
import { usePress } from 'react-aria';

import { Link, usePathname } from '@/lib/i18n';

export const SidebarNav = () => {
  const pathname = usePathname();
  return (
    <Sidebar className="border-r" label="Navigation">
      <nav className="flex flex-col gap-1 p-4">
        <NavLink href="/" active={pathname === '/'}>
          <House size={16} strokeWidth={1.5} /> Home
        </NavLink>
        <NavLink href="/org" active={pathname.startsWith('/org')}>
          <Users size={16} strokeWidth={1.5} /> Organizations
        </NavLink>
        <NavLink href="/processes" active={pathname.startsWith('/processes')}>
          <MessageCircle size={16} strokeWidth={1.5} /> Processes
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
        'flex items-center gap-2 rounded-sm p-3 hover:bg-offWhite hover:no-underline',
        active && 'bg-whiteish',
      )}
      {...pressProps}
    >
      {children}
    </Link>
  );
};
