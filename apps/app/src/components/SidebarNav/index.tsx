'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@op/sense/Sidebar';
import { ReactNode } from 'react';
import { usePress } from 'react-aria';
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
  return (
    // TODO(sense): Figma nav redesign pending — the op/ui <Sidebar> is mapped
    // onto shadcn primitives (Sidebar/SidebarContent/SidebarMenu). Offcanvas
    // preserves the op/ui default (nav hidden until the header trigger opens
    // it); the three links, icons, and active states are kept as-is.
    <Sidebar collapsible="offcanvas" className="border-e">
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
  const { pressProps } = usePress({
    onPress: isMobile ? toggleSidebar : undefined,
  });
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        render={<Link href={href} {...pressProps} />}
      >
        {children}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};
