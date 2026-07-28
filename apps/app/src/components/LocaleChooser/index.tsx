'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { useParams } from 'next/navigation';
import { LuGlobe } from 'react-icons/lu';

import { usePathname, useTranslations } from '@/lib/i18n';
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

/**
 * Language switcher. A DropdownMenu (not a Select): the globe button opens a
 * list of languages and *navigates* on choice — it's a menu of actions, not a
 * form value. DropdownMenuRadioGroup marks the current locale.
 */
export const LocaleChooser = ({ onClose }: LocaleChooserProps) => {
  const t = useTranslations();
  const pathname = usePathname();
  const params = useParams();
  const localeParam = params.locale;
  const currentLocale =
    (Array.isArray(localeParam) ? localeParam[0] : localeParam) ?? '';

  const handleValueChange = (value: string) => {
    if (value && value !== currentLocale) {
      // Hard navigation (not the client router) so the server applies the
      // vanity URL rewrite. Vanity decision paths like `/columbus` exist only
      // as a next.config rewrite, so a client-side transition to `/es/columbus`
      // can't resolve them and bounces anonymous viewers to /login. A full load
      // resolves the rewrite and keeps the pretty URL. Locale changes are rare,
      // so the reload is negligible.
      window.location.assign(`/${value}${pathname}`);
    }
    onClose?.();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('Select language')}
        className="flex size-8 items-center justify-center rounded-lg border border-input bg-background sm:size-11"
      >
        <LuGlobe className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={currentLocale}
          onValueChange={handleValueChange}
        >
          {i18nConfig.locales.map((locale) => (
            <DropdownMenuRadioItem key={locale} value={locale}>
              {localeDisplayNames[locale] || locale}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
