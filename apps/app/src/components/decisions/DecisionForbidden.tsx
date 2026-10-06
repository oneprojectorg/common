import { LogoHeader } from '@/components/LogoHeader';

import { ForbiddenContent } from './ForbiddenContent';

/** No access to a decision — or an invite to it the visitor can accept. */
export function DecisionForbidden() {
  return (
    <div className="flex size-full flex-col">
      <LogoHeader />
      <ForbiddenContent />
    </div>
  );
}
