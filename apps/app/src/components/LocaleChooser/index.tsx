'use client';

import { MenuItem } from '@op/ui/Menu';
import { useParams } from 'next/navigation';

import { useRouter as useI18nRouter, usePathname } from '@/lib/i18n';
import { i18nConfig } from '@/lib/i18n/config';

interface LocaleChooserProps {
  onClose?: () => void;
}

export const LocaleChooser = ({ onClose }: LocaleChooserProps) => {
  const i18nRouter = useI18nRouter();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = params.locale as string;

  return (
    <MenuItem
      id="language"
      className="bg-transparent px-0 pb-0 pt-2 hover:border-0 hover:bg-transparent hover:outline-0 focus:outline-0 sm:text-sm"
      onAction={() => {
        // Prevent default menu item action - we handle clicks on individual locale buttons
      }}
    >
      <div className="flex items-center gap-1">
        {i18nConfig.locales.map((locale, index) => (
          <span key={locale}>
            <button
              className={`hover:underline ${
                currentLocale === locale
                  ? 'font-bold text-primary-teal'
                  : 'text-neutral-charcoal'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (locale !== currentLocale) {
                  i18nRouter.replace(pathname, { locale });
                }
                onClose?.();
              }}
            >
              {locale}
            </button>
            {index < i18nConfig.locales.length - 1 && (
              <span className="mx-1 text-neutral-gray4">/</span>
            )}
          </span>
        ))}
      </div>
    </MenuItem>
  );
};
