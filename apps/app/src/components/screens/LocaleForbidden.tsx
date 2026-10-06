import { LogoHeader } from '@/components/LogoHeader';
import { ForbiddenScreen } from '@/components/screens/ForbiddenScreen';

/** No access to a closed-network page, and signing in again won't help. */
export function LocaleForbidden() {
  return (
    <div className="flex size-full flex-col">
      <LogoHeader />
      <div className="flex flex-1 flex-col">
        <ForbiddenScreen />
      </div>
    </div>
  );
}
