'use client';

import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { IconButton } from '@op/ui/IconButton';
import { Select, SelectItem } from '@op/ui/Select';
import { cn } from '@op/ui/utils';
import { useParams } from 'next/navigation';
import { LuGlobe } from 'react-icons/lu';

import { usePathname } from '@/lib/i18n';
import { useTranslations } from '@/lib/i18n';
import { i18nConfig } from '@/lib/i18n/config';

interface LocaleChooserProps {
  onClose?: () => void;
}

const localeDisplayNames: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
  bn: 'বাংলা',
  so: 'Af-Soomaali',
  ar: 'العربية',
};

export const LocaleChooser = ({ onClose }: LocaleChooserProps) => {
  const t = useTranslations();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = params.locale as string;

  const handleSelectionChange = (selectedKey: React.Key | null) => {
    if (selectedKey === null) {
      return;
    }
    const newLocale = selectedKey as string;
    if (newLocale !== currentLocale) {
      // Hard navigation (not the client router) so the server applies the
      // vanity URL rewrite. Vanity decision paths like `/columbus` exist only
      // as a next.config rewrite, so a client-side transition to `/es/columbus`
      // can't resolve them and bounces anonymous viewers to /login. A full load
      // resolves the rewrite and keeps the pretty URL. Locale changes are rare,
      // so the reload is negligible.
      window.location.assign(`/${newLocale}${pathname}`);
    }
    onClose?.();
  };

  return (
    <Select
      selectedKey={currentLocale}
      onSelectionChange={handleSelectionChange}
      aria-label={t('Select language')}
      listBoxClassName="max-h-none overflow-visible"
      popoverProps={{
        className: '!max-h-none overflow-visible',
        placement: 'bottom end',
      }}
      customTrigger={
        <>
          <IconButton
            aria-label={t('Select language')}
            variant="outline"
            size="medium"
            className="hidden sm:flex"
          >
            <LuGlobe className="size-4" />
          </IconButton>
          {isMobile ? (
            <Button
              color="neutral"
              unstyled
              variant="icon"
              className="flex size-8 items-center justify-center rounded-full bg-neutral-offWhite sm:hidden"
            >
              <LuGlobe className="size-4" />
            </Button>
          ) : null}
        </>
      }
    >
      {i18nConfig.locales.map((locale) => (
        <SelectItem
          key={locale}
          id={locale}
          className={cn(currentLocale === locale && 'text-primary-teal')}
        >
          <div
            className={cn(
              'flex items-center justify-between',
              currentLocale === locale && 'text-primary-teal',
            )}
          >
            <span>{localeDisplayNames[locale] || locale}</span>
          </div>
        </SelectItem>
      ))}
    </Select>
  );
};
