'use client';

import { useDirection } from '@op/sense/Direction';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@op/sense/Sidebar';
import { ReactNode } from 'react';
import { LuHouse, LuMessageCircle, LuUsers } from 'react-icons/lu';

import { Link, usePathname, useTranslations } from '@/lib/i18n';

interface NavLinkProps {
  href: string;
  active?: boolean;
  children: ReactNode;
}

export const SidebarNav = () => {
  const t = useTranslations();
  const pathname = usePathname();
  // The Sidebar positions itself with physical left/right, so the side has to
  // be told — otherwise the nav stays on the left in Arabic while everything
  // else mirrors around it.
  const isRtl = useDirection() === 'rtl';

  return (
    // Offcanvas: nav hidden until the header trigger opens it, pushing content;
    // overlay Sheet on mobile. Per shadcn's "sticky site header" (sidebar-16)
    // pattern, the desktop fixed panel is offset below the full-width header
    // via --header-height (set on the content row in the (main) layout).
    <Sidebar
      side={isRtl ? 'right' : 'left'}
      collapsible="offcanvas"
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]! border-e"
    >
      <SidebarContent>
        <SidebarMenu className="gap-1 p-4">
          <NavLink href="/" active={pathname === '/'}>
            <LuHouse className="size-4" /> {t('Home')}
          </NavLink>
          <NavLink href="/org" active={pathname.startsWith('/org')}>
            <LuUsers className="size-4" /> {t('Organizations')}
          </NavLink>
          <NavLink href="/decisions" active={pathname.startsWith('/decisions')}>
            <LuMessageCircle className="size-4" /> {t('Decisions')}
          </NavLink>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
};

const NavLink = ({ href, active, children }: NavLinkProps) => {
  const { toggleSidebar, isMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        className="no-underline hover:no-underline"
        render={
          <Link href={href} onClick={isMobile ? toggleSidebar : undefined} />
        }
      >
        {children}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};
