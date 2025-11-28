'use client';

import { useMediaQuery } from '@op/hooks';
import { Button } from '@op/ui/Button';
import { IconButton } from '@op/ui/IconButton';
import { Select, SelectItem } from '@op/ui/Select';
import { cn } from '@op/ui/utils';
import { useParams } from 'next/navigation';
import { LuGlobe } from 'react-icons/lu';

import { useRouter as useI18nRouter, usePathname } from '@/lib/i18n';
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
};

export const LocaleChooser = ({ onClose }: LocaleChooserProps) => {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const i18nRouter = useI18nRouter();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = params.locale as string;

  const handleSelectionChange = (selectedKey: React.Key) => {
    const newLocale = selectedKey as string;
    if (newLocale !== currentLocale) {
      i18nRouter.replace(pathname, { locale: newLocale });
    }
    onClose?.();
  };

  return (
    <Select
      selectedKey={currentLocale}
      onSelectionChange={handleSelectionChange}
      aria-label="Select language"
      customTrigger={
        <>
          <IconButton
            variant="outline"
            size="medium"
            className="hidden text-primary-teal sm:flex"
          >
            <LuGlobe className="size-4" />
          </IconButton>
          {isMobile ? (
            <Button
              color="neutral"
              unstyled
              variant="icon"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-neutral-offWhite sm:hidden"
            >
              <div className="flex size-8 items-center justify-center rounded-full bg-neutral-offWhite">
                <LuGlobe className="size-4" />
              </div>
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
