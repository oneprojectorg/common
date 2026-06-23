import { Link } from '@/lib/i18n';

import { CommonLogo } from '@/components/CommonLogo';
import PageError from '@/components/screens/PageError';

export default function Forbidden() {
  return (
    <div className="flex size-full flex-col">
      <header className="flex items-center p-4">
        <Link href="/">
          <CommonLogo />
        </Link>
      </header>
      <div className="flex flex-1 flex-col">
        <PageError reason="UNAUTHORIZED" />
      </div>
    </div>
  );
}
