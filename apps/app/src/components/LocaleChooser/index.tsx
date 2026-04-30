'use client';

import { IconButton } from '@op/ui/IconButton';
import { Menu, MenuItem, MenuTrigger } from '@op/ui/Menu';
import { Popover } from '@op/ui/Popover';
import { cn } from '@op/ui/utils';
import { useParams } from 'next/navigation';
import type { Key } from 'react';
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
};

export const LocaleChooser = ({ onClose }: LocaleChooserProps) => {
  const t = useTranslations();
  const i18nRouter = useI18nRouter();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = params.locale as string;

  const handleAction = (key: Key) => {
    const newLocale = key as string;
    if (newLocale !== currentLocale) {
      i18nRouter.replace(pathname, { locale: newLocale });
    }
    onClose?.();
  };

  return (
    <MenuTrigger>
      <IconButton
        variant="outline"
        aria-label={t('Select language')}
        className="text-primary"
      >
        <LuGlobe className="size-4" />
      </IconButton>
      <Popover placement="bottom end">
        <Menu onAction={handleAction}>
          {i18nConfig.locales.map((locale) => (
            <MenuItem
              key={locale}
              id={locale}
              className={cn(currentLocale === locale && 'text-primary')}
            >
              {localeDisplayNames[locale] || locale}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
};
