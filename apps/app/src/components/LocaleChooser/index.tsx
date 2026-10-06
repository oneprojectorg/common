import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { useParams } from '@tanstack/react-router';
import { LuGlobe } from 'react-icons/lu';

import { usePathname, useTranslations } from '@/lib/i18n';
import { type Locale, i18nConfig } from '@/lib/i18n/config';

interface LocaleChooserProps {
  onClose?: () => void;
}

// Keyed on Locale so adding a supported locale without its endonym here is a
// typecheck failure rather than a raw code (`hu`) rendered in the menu.
const localeDisplayNames: Record<Locale, string> = {
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
  const pathname = usePathname();
  const currentLocale = useParams({
    strict: false,
    select: (params) => params.locale ?? '',
  });

  const handleValueChange = (value: string) => {
    if (value && value !== currentLocale) {
      // Hard navigation (not the client router): the whole document — its
      // lang, dir and dictionary — follows the locale, and a full load also
      // keeps a vanity decision URL like `/columbus` pretty. Locale changes
      // are rare, so the reload is negligible.
      window.location.assign(`/${value}${pathname}`);
    }
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
