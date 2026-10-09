'use client';

import { Button } from '@op/sense/Button';
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
import { type Locale, i18nConfig } from '@/lib/i18n/config';

interface LocaleChooserProps {
  onClose?: () => void;
}

// Keyed on Locale so adding a supported locale without its endonym here is a
// typecheck failure rather than a raw code (`hu`) rendered in the menu.
export const localeDisplayNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
  bn: 'বাংলা',
  so: 'Af-Soomaali',
  ar: 'العربية',
  hu: 'Magyar',
};

/**
 * Language switcher. A DropdownMenu (not a Select): the globe button opens a
 * list of languages and *navigates* on choice — it's a menu of actions, not a
 * form value. DropdownMenuRadioGroup marks the current locale.
 */
export const LocaleChooser = ({ onClose }: LocaleChooserProps) => {
  const t = useTranslations('shell');
  const { currentLocale, switchLocale } = useLocaleSwitch();

  const handleValueChange = (value: string) => {
    switchLocale(value);
    onClose?.();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={t('localeChooserLabel')}
          />
        }
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
              {localeDisplayNames[locale]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * The locale in the URL, and a way to move to another one. Shared by the
 * header's globe menu and the language setting in the Settings modal.
 */
export const useLocaleSwitch = () => {
  const pathname = usePathname();
  const params = useParams();
  const localeParam = params.locale;
  const currentLocale =
    (Array.isArray(localeParam) ? localeParam[0] : localeParam) ?? '';

  const switchLocale = (value: string) => {
    if (value && value !== currentLocale) {
      // Hard navigation (not the client router) so the server applies the
      // vanity URL rewrite. Vanity decision paths like `/columbus` exist only
      // as a next.config rewrite, so a client-side transition to `/es/columbus`
      // can't resolve them and bounces anonymous viewers to /login. A full load
      // resolves the rewrite and keeps the pretty URL. Locale changes are rare,
      // so the reload is negligible.
      window.location.assign(`/${value}${pathname}`);
    }
  };

  return { currentLocale, switchLocale };
};
