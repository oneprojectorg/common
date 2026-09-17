import { Link } from '@/lib/i18n';

import { CommonLogo } from '../CommonLogo';
import { LocaleChooser } from '../LocaleChooser';

/**
 * Minimal chrome for screens that render outside `SiteHeader` and carry no
 * actions of their own: the logo home link and the locale chooser. Boundary
 * screens are the ones a viewer is most likely to land on in a language they
 * don't read, so the chooser is part of the header rather than a per-page
 * decision.
 */
export const LogoHeader = () => (
  <header className="flex items-center justify-between p-4">
    <Link href="/">
      <CommonLogo />
    </Link>
    <LocaleChooser />
  </header>
);
