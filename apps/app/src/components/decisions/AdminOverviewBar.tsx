'use client';

import { formatDate } from '@/utils/formatting';
import { Button } from '@op/ui/Button';
import { MenuItem, MenuList } from '@op/ui/Menu';
import { Sheet, SheetBody } from '@op/ui/Sheet';
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
        date: formatDate(phaseEndDate, locale, {
          month: 'long',
          day: 'numeric',
        }),
      })
    : null;

  return (
    <>
      {/* Bespoke full-width tinted admin bar — no Button variant matches this
          shape, so render an unstyled Button for RAC press/focus a11y. */}
      <Button
        unstyled
        onPress={() => setSheetOpen(true)}
        className="flex w-full items-center justify-center gap-2 bg-primary-tealWhite px-4 py-2 text-base md:hidden"
      >
        <span className="flex items-center gap-1.5 text-neutral-charcoal">
          <LuEye className="size-4" aria-hidden="true" />
          {t('Admin')}
        </span>
        {phaseName ? (
          <>
            <span aria-hidden="true" className="text-neutral-black">
              |
            </span>
            <span className="flex items-end gap-1.5">
              <span className="text-neutral-black">{phaseName}</span>
              {endsLabel ? (
                <span className="text-sm text-neutral-gray4">{endsLabel}</span>
              ) : null}
            </span>
          </>
        ) : null}
      </Button>

      <Sheet
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
        side="bottom"
        className="md:hidden"
      >
        <SheetBody>
          <MenuList
            aria-label={t('Admin options')}
            className="flex min-w-full flex-col border-0 p-0 shadow-none"
          >
            <MenuItem
              id="edit-banner"
              className="px-6 py-4"
              onAction={() => {
                setSheetOpen(false);
                setBannerOpen(true);
              }}
            >
              {t('Edit banner')}
            </MenuItem>
            <MenuItem
              id="process-settings"
              className="px-6 py-4"
              onAction={() => router.push(`/decisions/${decisionSlug}/edit`)}
            >
              {t('Process settings')}
            </MenuItem>
          </MenuList>
        </SheetBody>
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
