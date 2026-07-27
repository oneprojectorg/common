'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@op/sense/Select';
import { cn } from '@op/sense/lib/utils';
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

export const LocaleChooser = ({ onClose }: LocaleChooserProps) => {
  const t = useTranslations();
  const pathname = usePathname();
  const params = useParams();
  const localeParam = params.locale;
  const currentLocale =
    (Array.isArray(localeParam) ? localeParam[0] : localeParam) ?? '';

  const handleValueChange = (value: string | null) => {
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
    // Passing `items` gives base-ui the value→label map so any SelectValue
    // would render "English" not "en"; the trigger here is icon-only, so the
    // raw-value gotcha never surfaces, but the map keeps the labels correct.
    <Select
      value={currentLocale}
      onValueChange={handleValueChange}
      items={localeDisplayNames}
    >
      <SelectTrigger
        aria-label={t('Select language')}
        className="h-auto w-fit gap-0 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 [&>svg:last-child]:hidden"
      >
        <span className="hidden size-8 items-center justify-center rounded-md border border-input sm:flex">
          <LuGlobe className="size-4" />
        </span>
        <span className="flex size-8 items-center justify-center rounded-full bg-neutral-offWhite sm:hidden">
          <LuGlobe className="size-4" />
        </span>
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false}>
        {i18nConfig.locales.map((locale) => (
          <SelectItem
            key={locale}
            value={locale}
            className={cn(currentLocale === locale && 'text-primary-teal')}
          >
            {localeDisplayNames[locale] || locale}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
