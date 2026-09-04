import type { ReactNode } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { getTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

/** Shared shell: the Back + action row inside the content column, then the body. */
export async function AssignmentsPageShell({
  backHref,
  action,
  children,
}: {
  backHref: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const t = await getTranslations();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AssignmentsMain>
        <div className="flex items-center justify-between gap-4">
          <ButtonLink
            href={backHref}
            variant="link"
            className="px-0 text-muted-foreground hover:text-foreground hover:no-underline"
          >
            <LuArrowLeft className="size-4 rtl:-scale-x-100" />
            {t('Back')}
          </ButtonLink>
          {action}
        </div>
        {children}
      </AssignmentsMain>
    </div>
  );
}

export function AssignmentsMain({ children }: { children: ReactNode }) {
  // 64rem — the width the design was composed at.
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pt-10 pb-16">
      {children}
    </main>
  );
}
