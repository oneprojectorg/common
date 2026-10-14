'use client';

import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { PAGE_LIMIT, nextCursor } from '@op/common/client';
import { useDirection } from '@op/sense/Direction';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@op/sense/Sidebar';
import { ReactNode, Suspense, useState } from 'react';
import { LuActivity, LuHouse, LuMessageCircle, LuUsers } from 'react-icons/lu';

import { Link, usePathname, useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';

interface NavLinkProps {
  href: string;
  active?: boolean;
  children: ReactNode;
}

/** How many decisions the sidebar lists before deferring to /decisions. */
const MAX_SIDEBAR_DECISIONS = 3;

const ACTIVE_DECISIONS_LIST_ID = 'sidebar-active-decisions';

export const SidebarNav = () => {
  const t = useTranslations();
  const pathname = usePathname();
  // The Sidebar positions itself with physical left/right, so the side has to
  // be told — otherwise the nav stays on the left in Arabic while everything
  // else mirrors around it.
  const isRtl = useDirection() === 'rtl';

  return (
    // Offcanvas: the header trigger collapses the nav, pushing content; overlay
    // Sheet on mobile. Per shadcn's "sticky site header" (sidebar-16) pattern,
    // the desktop fixed panel is offset below the full-width header via
    // --header-height (set on the content row in the (main) layout).
    <Sidebar
      side={isRtl ? 'right' : 'left'}
      collapsible="offcanvas"
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]! border-none"
    >
      <SidebarContent className="gap-4 overscroll-contain ps-6 pe-4 pt-4 pb-8">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <NavLink href="/" active={pathname === '/'}>
                <LuHouse /> {t('Home')}
              </NavLink>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="mx-0" />
        <SidebarGroup className="p-0">
          <SidebarGroupLabel>{t('shell.exploreNavHeading')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavLink href="/updates" active={pathname.startsWith('/updates')}>
                <LuActivity /> {t('shell.updatesNavTitle')}
              </NavLink>
              <NavLink href="/decisions" active={pathname === '/decisions'}>
                <LuMessageCircle /> {t('decisions.decisionsLabel')}
              </NavLink>
              <NavLink href="/org" active={pathname.startsWith('/org')}>
                <LuUsers /> {t('Organizations')}
              </NavLink>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* Empty fragment, not null: ErrorBoundary renders `fallback ?? <ErrorMessage />`,
            so an explicit null still shows the error UI instead of hiding the group. */}
        <ErrorBoundary fallback={<></>}>
          <Suspense fallback={null}>
            <ActiveDecisionsGroup />
          </Suspense>
        </ErrorBoundary>
      </SidebarContent>
    </Sidebar>
  );
};

/**
 * The published decisions the user belongs to: three, then "See more"
 * expands the list in place (paging further when the server has more).
 */
const ActiveDecisionsGroup = () => {
  const t = useTranslations();
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);

  const [{ pages }, { hasNextPage, fetchNextPage, isFetchingNextPage }] =
    trpc.decision.listDecisionProfiles.useSuspenseInfiniteQuery(
      { status: [ProcessStatus.PUBLISHED], limit: PAGE_LIMIT.sm },
      { getNextPageParam: nextCursor },
    );
  const decisions = pages.flatMap((page) => page.items);

  if (decisions.length === 0) {
    return null;
  }

  const visible = isExpanded
    ? decisions
    : decisions.slice(0, MAX_SIDEBAR_DECISIONS);
  // Collapsed: more if anything is hidden. Expanded: more if the server has
  // another page.
  const canSeeMore = isExpanded
    ? hasNextPage
    : decisions.length > MAX_SIDEBAR_DECISIONS || hasNextPage;

  const seeMore = () => {
    if (isExpanded || decisions.length <= MAX_SIDEBAR_DECISIONS) {
      fetchNextPage();
    }
    setIsExpanded(true);
  };

  return (
    <>
      <SidebarSeparator className="mx-0" />
      <SidebarGroup className="p-0">
        <SidebarGroupLabel>
          {t('decisions.activeDecisionsHeading')}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu id={ACTIVE_DECISIONS_LIST_ID}>
            {visible.map((decision) => (
              <NavLink
                key={decision.id}
                href={`/decisions/${decision.slug}`}
                active={pathname.startsWith(`/decisions/${decision.slug}`)}
              >
                <span dir="auto" className="ltr:text-left rtl:text-right">
                  {decision.name}
                </span>
              </NavLink>
            ))}
            {canSeeMore && (
              <ListToggle
                onClick={seeMore}
                isExpanded={false}
                isLoading={isFetchingNextPage}
              >
                {t('shell.seeMoreAction')}
              </ListToggle>
            )}
            {isExpanded && !canSeeMore && (
              <ListToggle onClick={() => setIsExpanded(false)} isExpanded>
                {t('shell.seeLessAction')}
              </ListToggle>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
};

/** Expands or collapses the Active Decisions list in place. */
const ListToggle = ({
  onClick,
  isExpanded,
  isLoading = false,
  children,
}: {
  onClick: () => void;
  isExpanded: boolean;
  isLoading?: boolean;
  children: ReactNode;
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton
      onClick={onClick}
      disabled={isLoading}
      aria-expanded={isExpanded}
      aria-controls={ACTIVE_DECISIONS_LIST_ID}
      className="text-muted-foreground"
    >
      {children}
    </SidebarMenuButton>
  </SidebarMenuItem>
);

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
