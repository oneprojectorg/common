import { LogoHeader } from '@/components/LogoHeader';
import { ForbiddenScreen } from '@/components/screens/ForbiddenScreen';

export default function Forbidden() {
  return (
    <div className="flex size-full flex-col">
      <LogoHeader />
      <div className="flex flex-1 flex-col">
        <ForbiddenScreen />
      </div>
    </div>
  );
}
