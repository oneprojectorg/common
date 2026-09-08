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
import type { ReactNode } from 'react';
import { LuHouse, LuMessageCircle, LuUsers } from 'react-icons/lu';

import { Link, usePathname, useTranslations } from '@/lib/i18n';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The real `SidebarNav` with prototype destinations. It is copied rather than
 * reused because the real one hardcodes the product's hrefs, and teaching it
 * about a prototype prefix would be churn in shipping code.
 */
export function PrototypeSidebarNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const isRtl = useDirection() === 'rtl';

  return (
    <Sidebar
      side={isRtl ? 'right' : 'left'}
      collapsible="offcanvas"
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]! border-e"
    >
      <SidebarContent>
        <SidebarMenu className="gap-1 p-4">
          {/* The prototype has one surface, so Home and Organizations lead to
              it rather than to a page with nothing on it. */}
          <NavLink href="/prototype/decisions" active={false}>
            <LuHouse className="size-4" /> {t('Home')}
          </NavLink>
          <NavLink href="/prototype/decisions" active={false}>
            <LuUsers className="size-4" /> {t('Organizations')}
          </NavLink>
          <NavLink
            href="/prototype/decisions"
            active={pathname.startsWith('/prototype/decisions')}
          >
            <LuMessageCircle className="size-4" /> {t('Decisions')}
          </NavLink>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}

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
