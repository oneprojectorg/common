'use client';

import { UserProvider } from '@/utils/UserProvider';
import { SidebarInset, SidebarProvider } from '@op/sense/Sidebar';
import type { ReactNode } from 'react';

import { usePathname } from '@/lib/i18n';

import { PrototypeSidebarNav } from './PrototypeSidebarNav';
import { PrototypeSiteHeader } from './PrototypeSiteHeader';
import { PROTOTYPE_USER } from './fakeUser';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The app frame — header, sidebar, content column — assembled the way the real
 * `(main)` layout assembles it, but around a fake session so it renders with no
 * login and no database. Wrapping in `UserProvider` is what lets the real
 * components inside (the header's menus, anything calling `useUser`) behave
 * normally; the nested provider shadows the null one from `(no-header)`.
 */
export function PrototypeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Two surfaces replace the app frame rather than sitting inside it, exactly
  // as they do in the product: the wizard (its own close control) and a process
  // page (its own header — Back, the Overview/Current Phase toggle, Edit process).
  // Anything below /prototype/decisions is one of those. Checked here rather
  // than split across route groups, which would make `decisions/new` and
  // `decisions/[id]` resolve in sibling groups for no gain in a throwaway tree.
  const isFullScreen = /\/prototype\/decisions\/.+/.test(pathname);

  if (isFullScreen) {
    return <UserProvider initialUser={PROTOTYPE_USER}>{children}</UserProvider>;
  }

  return (
    <div className="flex size-full max-h-full flex-col">
      <UserProvider initialUser={PROTOTYPE_USER}>
        <SidebarProvider
          defaultOpen={false}
          className="min-h-0 flex-1 flex-col overflow-hidden"
        >
          <PrototypeSiteHeader />
          <div
            style={{ '--header-height': '3.75rem' } as React.CSSProperties}
            className="relative flex size-full flex-1 flex-col overflow-y-auto bg-background sm:flex-row"
          >
            <PrototypeSidebarNav />
            <SidebarInset>
              <div className="flex grow justify-center">
                <div className="w-full max-w-[68rem]">{children}</div>
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </UserProvider>
    </div>
  );
}
