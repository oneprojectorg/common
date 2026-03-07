'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { useQueryState } from 'nuqs';

import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { useProcessBuilderValidation } from '../../validation/useProcessBuilderValidation';

const CHECKLIST_SECTION_MAP: Record<string, string> = {
  processNameDescription: 'overview',
  atLeastOnePhase: 'phases',
  phaseDetails: 'phases',
  proposalTemplate: 'templateEditor',
  proposalTemplateErrors: 'templateEditor',
  inviteMembers: 'participants',
};

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

  const { isReadyToLaunch, checklist } =
    useProcessBuilderValidation(decisionProfileId);

  const [, setSectionParam] = useQueryState('section', { history: 'push' });

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

  if (!isReadyToLaunch) {
    const incompleteItems = checklist.filter((item) => !item.isValid);

    return (
      <div className="mx-auto flex w-full flex-col gap-6 p-4 md:max-w-160 md:p-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-neutral-gray4">{t('Summary')}</p>
          <h2 className="font-serif text-title-base">
            {t('Your process still needs more information')}
          </h2>
        </div>
        <p className="text-base text-neutral-black">
          <span className="font-bold">{processName}</span>{' '}
          {t('is missing information in order to go live.')}
        </p>
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          {incompleteItems.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center justify-between${
                index < incompleteItems.length - 1
                  ? 'border-b border-neutral-gray1 pb-2'
                  : ''
              }`}
            >
              <span className="text-sm text-neutral-black">
                {t(item.labelKey)}
              </span>
              <Button
                color="secondary"
                className="shrink-0"
                onPress={() => {
                  const sectionId = CHECKLIST_SECTION_MAP[item.id];
                  if (sectionId) {
                    void setSectionParam(sectionId);
                  }
                }}
              >
                {t('Take me there')}
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col gap-6 p-4 md:max-w-160 md:p-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-neutral-gray4">{t('Summary')} 🚀</p>
        <h2 className="font-serif text-title-base">
          {t('Review your process')}
        </h2>
      </div>
      <p>
        <span className="font-bold">{processName}</span>{' '}
        {t(
          'is ready to go live. Launching your process will invite and notify participants.',
        )}
      </p>
      <p>{t('You can always edit and invite participants after launching.')}</p>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <div className="flex items-center justify-between border-b border-neutral-gray1 pb-2">
          <span className="text-base text-neutral-gray4">{t('Phases')}</span>
          <span className="text-base text-neutral-charcoal">{phasesCount}</span>
        </div>
        <div className="flex items-center justify-between border-b border-neutral-gray1 pb-2">
          <span className="text-base text-neutral-gray4">
            {t('Categories')}
          </span>
          <span className="text-base text-neutral-charcoal">
            {categories.length}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-base text-neutral-gray4">
            {t('Participants Invited')}
          </span>
          <span className="text-base text-neutral-charcoal">
            {participantsCount}
          </span>
        </div>
      </div>
    </div>
  );
}
