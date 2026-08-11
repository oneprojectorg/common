'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@op/sense/Sheet';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { LuEye } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { BannerUploadModal } from './BannerUploadModal';

/**
 * Mobile-only admin bar shown above the overview hero (replaces the desktop
 * "Edit banner" button). Tapping it opens a bottom sheet with the admin
 * actions: edit the banner image, or jump to process settings.
 */
export function AdminOverviewBar({
  instanceId,
  decisionSlug,
  heroImagePath,
  phaseName,
  phaseEndDate,
}: {
  instanceId: string;
  decisionSlug: string;
  heroImagePath?: string;
  /** Current phase name, e.g. "Collect Ideas". */
  phaseName?: string;
  /** Current phase end date (ISO string), shown as "ends {date}". */
  phaseEndDate?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);

  const endsLabel = phaseEndDate
    ? t('ends {date}', {
        date: new Date(phaseEndDate).toLocaleDateString(locale, {
          month: 'long',
          day: 'numeric',
        }),
      })
    : null;

  return (
    <>
      {/* Bespoke full-width tinted admin bar — no @op/sense Button variant
          matches this shape (sense Button dropped @op/ui's `unstyled`), so
          render a native <button> for press/focus a11y. */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex w-full items-center justify-center gap-2 bg-accent px-4 py-2 text-base md:hidden"
      >
        <span className="flex items-center gap-1.5">
          <LuEye className="size-4" aria-hidden="true" />
          {t('Admin')}
        </span>
        {phaseName ? (
          <>
            <span aria-hidden="true">|</span>
            <span className="flex items-end gap-1.5">
              <span>{phaseName}</span>
              {endsLabel ? (
                <span className="text-sm text-muted-foreground">
                  {endsLabel}
                </span>
              ) : null}
            </span>
          </>
        ) : null}
      </button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('Admin options')}</SheetTitle>
          </SheetHeader>
          {/* TODO(sense-migration): @op/ui MenuList/MenuItem was used as an
              inline action list inside the sheet (no trigger/popover). @op/sense
              DropdownMenu requires a DropdownMenuTrigger + portaled
              DropdownMenuContent, so it can't render inline here. Rebuilt as a
              native <button> list to preserve the bottom-sheet action rows. */}
          <div className="flex min-w-full flex-col">
            <button
              type="button"
              className="px-6 py-4 text-start text-base hover:bg-secondary"
              onClick={() => {
                setSheetOpen(false);
                setBannerOpen(true);
              }}
            >
              {t('Edit banner')}
            </button>
            <button
              type="button"
              className="px-6 py-4 text-start text-base hover:bg-secondary"
              onClick={() => router.push(`/decisions/${decisionSlug}/edit`)}
            >
              {t('Process settings')}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <BannerUploadModal
        instanceId={instanceId}
        heroImagePath={heroImagePath}
        isOpen={bannerOpen}
        onOpenChange={setBannerOpen}
      />
    </>
  );
}
