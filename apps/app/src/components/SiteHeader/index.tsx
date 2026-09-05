import { getTranslations } from 'next-intl/server';

import { Link } from '@/lib/i18n';

import { CommonLogo } from '../CommonLogo';
import { HeaderActions } from './HeaderActions';
import { HeaderShell } from './HeaderShell';

/**
 * One responsive header for desktop and mobile, rendered once (not a
 * desktop/mobile pair) so shared bits — logo, menu trigger, actions — mount a
 * single time; that's what keeps CommonLogo's inlined gradient ids unique.
 *
 * This half is a server component: the wordmark and the header copy never need
 * the client, so they are rendered here and handed to {@link HeaderShell}, the
 * island that owns the mobile search state. Resolve copy with
 * `getTranslations()` rather than `TranslatedText` — the latter would put a
 * client boundary back around the chrome we just moved to the server. Every key
 * below is period-free, so the dot-to-underscore lookup that `useTranslations`
 * applies (see `lib/i18n/messageKeys.ts`) is a no-op for them.
 */
export const SiteHeader = async () => {
  const t = await getTranslations();

  return (
    <HeaderShell
      menuLabel={t('Open menu')}
      searchLabel={t('Search')}
      cancelLabel={t('Cancel')}
      logo={
        <Link href="/" aria-label={t('Home')}>
          <CommonLogo />
        </Link>
      }
      actions={<HeaderActions />}
    />
  );
};
