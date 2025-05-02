import type { Organization } from '@op/trpc/encoders';
import { Header1 } from '@op/ui/Header';

import { useTranslations } from '@/lib/i18n';

export const ProfileSummary = ({ profile }: { profile: Organization }) => {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-4">
      <Header1>{profile.name}</Header1>
      <div className="text-base text-neutral-gray4">
        {profile.city && profile.state
          ? `${profile.city}, ${profile.state}`
          : null}
      </div>
      <div className="flex flex-col-reverse gap-6 sm:flex-col">
        <div className="flex gap-1 text-base text-neutral-gray4">
          <span className="font-semibold">482</span> {t('relationships')}
        </div>
        <div className="text-base text-neutral-charcoal">
          {profile.description}
        </div>
      </div>
    </div>
  );
};
