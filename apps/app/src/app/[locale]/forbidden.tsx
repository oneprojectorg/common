import { Link } from '@/lib/i18n';

import { CommonLogo } from '@/components/CommonLogo';
import { LocaleChooser } from '@/components/LocaleChooser';
import { ForbiddenScreen } from '@/components/screens/ForbiddenScreen';

export default function Forbidden() {
  return (
    <div className="flex size-full flex-col">
      <header className="flex items-center justify-between p-4">
        <Link href="/">
          <CommonLogo />
        </Link>
        <LocaleChooser />
      </header>
      <div className="flex flex-1 flex-col">
        <ForbiddenScreen />
      </div>
    </div>
  );
}
