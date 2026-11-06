import type { ReactNode } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { getTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';
import { UserAvatarMenu } from '@/components/SiteHeader/UserAvatarMenu';

/** Shared shell: a sticky Back + account row at the gutters, then the body at the page width. */
export async function AssignmentsPageShell({
  backHref,
  children,
}: {
  backHref: string;
  children: ReactNode;
}) {
  const t = await getTranslations();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AssignmentsTopRow>
        <ButtonLink
          href={backHref}
          variant="link"
          className="px-0 text-muted-foreground hover:text-foreground hover:no-underline"
        >
          <LuArrowLeft className="size-4 rtl:-scale-x-100" />
          {t('Back')}
        </ButtonLink>
        <UserAvatarMenu />
      </AssignmentsTopRow>
      <AssignmentsMain>{children}</AssignmentsMain>
    </div>
  );
}

export function AssignmentsTopRow({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-20 flex h-15 shrink-0 items-center justify-between gap-4 border-b bg-background px-4 md:px-8">
      {children}
    </div>
  );
}

export function AssignmentsMain({ children }: { children: ReactNode }) {
  // 86rem — the page width the design was composed at.
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-8 px-4 pt-10 pb-18 md:px-8">
      {children}
    </main>
  );
}
