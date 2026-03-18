import { Link } from '@/lib/i18n';

import { CommonLogo } from '@/components/CommonLogo';

import { ForbiddenContent } from './ForbiddenContent';

export default function Forbidden() {
  return (
    <div className="flex size-full flex-col">
      <header className="flex items-center p-4">
        <Link href="/">
          <CommonLogo />
        </Link>
      </header>
      <ForbiddenContent />
    </div>
  );
}
