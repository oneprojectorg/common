import { LogoHeader } from '@/components/LogoHeader';

import { ForbiddenContent } from './ForbiddenContent';

export default function Forbidden() {
  return (
    <div className="flex size-full flex-col">
      <LogoHeader />
      <ForbiddenContent />
    </div>
  );
}
