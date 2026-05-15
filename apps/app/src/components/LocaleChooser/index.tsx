'use client';

import { IconButton } from '@op/ui-next/IconButton';
import { Select, SelectItem } from '@op/ui-next/Select';
import { cn } from '@op/ui/utils';
import { useParams } from 'next/navigation';
import { LuGlobe } from 'react-icons/lu';

import { useRouter as useI18nRouter, usePathname } from '@/lib/i18n';
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
};

export const LocaleChooser = ({ onClose }: LocaleChooserProps) => {
  const t = useTranslations();
  const i18nRouter = useI18nRouter();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = params.locale as string;

  const handleSelectionChange = (selectedKey: React.Key | null) => {
    if (selectedKey === null) {
      return;
    }
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
      aria-label={t('Select language')}
      customTrigger={
        <IconButton
          aria-label={t('Select language')}
          variant="outline"
          size="medium"
          className="border-0 bg-neutral-offWhite text-primary-teal sm:border sm:bg-transparent"
        >
          <LuGlobe className="size-4" />
        </IconButton>
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
