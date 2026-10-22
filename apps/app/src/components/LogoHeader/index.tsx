import { Link } from '@/lib/i18n';

import { CommonLogo } from '../CommonLogo';
import { LocaleChooser } from '../LocaleChooser';

export const LogoHeader = () => (
  <header className="flex items-center justify-between p-4">
    <Link href="/">
      <CommonLogo />
    </Link>
    <LocaleChooser />
  </header>
);
