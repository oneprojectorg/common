'use client';

import { SidebarLayout, SidebarProvider } from '@op/ui/Sidebar';

import { usePathname } from '@/lib/i18n';

import { SidebarNav } from '@/components/SidebarNav';
import { SiteHeader } from '@/components/SiteHeader';
import { AppLayout } from '@/components/layout/split/AppLayout';

// Routes that render full-screen without the header/sidebar chrome — these were
// formerly the (no-header) route group. usePathname() (next-intl) returns a
// locale-stripped path, e.g. "/decisions/my-slug". The optional /xx prefix in
// the patterns is defensive in case a locale-prefixed path is ever passed.
const FULLSCREEN_PATTERNS = [
  /^(?:\/[a-z]{2})?\/decisions\/[^/]+/, // decision detail + nested (proposal/reviews/edit)
  /^(?:\/[a-z]{2})?\/profile\/[^/]+\/decisions\//, // profile-scoped decision detail
  /^(?:\/[a-z]{2})?\/profile\/[^/]+\/posts\//, // profile-scoped post detail
];

const isFullScreen = (pathname: string) => {
  return FULLSCREEN_PATTERNS.some((re) => re.test(pathname));
};

/**
 * Renders authenticated app chrome (header + sidebar) for standard routes, or
 * passes children through untouched for full-screen routes. Living in a single
 * shared layout (see (app)/layout.tsx) is what avoids the cross-route-group
 * client-manifest 500.
 */
export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();

  if (isFullScreen(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex size-full max-h-full flex-col">
      <SidebarProvider>
        <SiteHeader />
        <SidebarLayout>
          <SidebarNav />
          <AppLayout>{children}</AppLayout>
        </SidebarLayout>
      </SidebarProvider>
    </div>
  );
};
