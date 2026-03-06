'use client';

import { trpc } from '@op/api/client';

import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';

export function SummarySectionInner({
  decisionProfileId,
  instanceId,
  decisionName,
}: SectionProps) {
  const t = useTranslations();
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  // Fetch up to the API maximum (100) to count active participants.
  // The API does not expose a dedicated count endpoint, so we use the
  // max page size. For profiles with >100 members the displayed count
  // will be a minimum (usersData.next will be non-null in that case).
  const [usersData] = trpc.profile.listUsers.useSuspenseQuery({
    profileId: decisionProfileId,
    limit: 100,
  });
  const [invites] = trpc.profile.listProfileInvites.useSuspenseQuery({
    profileId: decisionProfileId,
  });

  const storePhases = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId]?.phases,
  );
  const storeCategories = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId]?.config?.categories,
  );

  const isDraft = instance.status === 'draft';
  const instancePhases = instance.instanceData?.phases;
  const instanceCategories = instance.instanceData?.config?.categories;
  const templatePhases = instance.process?.processSchema?.phases;

  const phasesCount =
    (!isDraft && storePhases?.length
      ? storePhases.length
      : instancePhases?.length) ??
    templatePhases?.length ??
    0;

  const categories = storeCategories ?? instanceCategories ?? [];
  const activeUsersCount = usersData.items?.length ?? 0;
  const participantsCount = activeUsersCount + (invites?.length ?? 0);

  const processName = decisionName || instance.name || '';

  return (
    <div className="mx-auto w-full space-y-4 p-4 md:max-w-160 md:p-8">
      <div>
        <p className="text-xs text-neutral-gray4">{t('Summary')} 🚀</p>
        <h2 className="font-serif text-title-sm">{t('Review your process')}</h2>
      </div>
      <div className="space-y-2">
        <p>
          <span className="font-bold">{processName}</span>{' '}
          {t(
            'is ready to go live. Launching your process will invite and notify participants.',
          )}
        </p>
        <p>{t('You can always edit and invite participants after launching.')}</p>
      </div>
      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-neutral-gray4">{t('Phases')}</span>
          <span className="text-right text-neutral-charcoal">{phasesCount}</span>
        </div>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-neutral-gray4">{t('Categories')}</span>
          <span className="text-right text-neutral-charcoal">
            {categories.length}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-neutral-gray4">{t('Participants Invited')}</span>
          <span className="text-right text-neutral-charcoal">
            {participantsCount}
          </span>
        </div>
      </div>
    </div>
  );
}
