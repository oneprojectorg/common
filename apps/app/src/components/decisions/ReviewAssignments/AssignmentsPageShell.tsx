import type { ReactNode } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { getTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';
import { UserAvatarMenu } from '@/components/SiteHeader/UserAvatarMenu';

/** Shared shell: a full-width Back + account row, then the body in the content column. */
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
    <div className="border-b border-border">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
        {children}
      </div>
    </div>
  );
}

export function AssignmentsMain({ children }: { children: ReactNode }) {
  // 64rem — the width the design was composed at.
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pt-8 pb-16">
      {children}
    </main>
  );
}
