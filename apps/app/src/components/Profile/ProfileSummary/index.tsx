import type { Organization } from '@op/trpc/encoders';
import { useTranslations } from 'next-intl';

import { Header1 } from '@/components/Header';

export const ProfileSummary = ({ profile }: { profile: Organization }) => {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-4 py-2">
      <Header1>{profile.name}</Header1>
      <div className="text-sm text-darkGray">
        {profile.city && profile.state
          ? `${profile.city}, ${profile.state}`
          : null}
      </div>
      <div className="flex flex-col-reverse gap-4 sm:flex-col">
        <div className="text-sm text-darkGray">
          <span className="font-semibold">0</span> {t('relationships')}
        </div>
        <div className="text-base">{profile.description}</div>
      </div>
    </div>
  );
};
