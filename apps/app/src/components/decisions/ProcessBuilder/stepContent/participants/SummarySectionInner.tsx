'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';
import { useQueryState } from 'nuqs';
import React from 'react';

import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { useProcessBuilderValidation } from '../../validation/useProcessBuilderValidation';

export function SummarySectionInner({
  decisionProfileId,
  instanceId,
  decisionName,
}: SectionProps) {
  const t = useTranslations();
  // Fetch up to the API maximum (100) to count active participants.
  // The API does not expose a dedicated count endpoint, so we use the
  // max page size. For profiles with >100 members the displayed count
  // will be a minimum (usersData.next will be non-null in that case).
  const [[instance, usersData, invites]] = trpc.useSuspenseQueries((t) => [
    t.decision.getInstance({ instanceId }),
    t.profile.listUsers({ profileId: decisionProfileId, limit: 100 }),
    t.profile.listProfileInvites({ profileId: decisionProfileId }),
  ]);

  const storePhases = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId]?.phases,
  );
  const storeCategories = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId]?.config?.categories,
  );

  const { isReadyToLaunch, checklist } =
    useProcessBuilderValidation(decisionProfileId);

  const [, setSectionParam] = useQueryState('section', { history: 'push' });

  const reviewFlowEnabled = useFeatureFlag('review_flow');
  const rubricSection = reviewFlowEnabled ? 'reviewRubric' : 'criteria';
  const checklistSectionMap: Record<string, string> = {
    processNameDescription: 'overview',
    atLeastOnePhase: 'phases',
    phaseDetails: 'phases',
    proposalTemplate: 'templateEditor',
    proposalTemplateErrors: 'templateEditor',
    rubricCriteria: rubricSection,
    rubricCriteriaErrors: rubricSection,
    inviteMembers: 'participants',
  };

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
  const storeOrganizeByCategories = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId]?.config?.organizeByCategories,
  );
  const organizeByCategories =
    storeOrganizeByCategories ??
    instance.instanceData?.config?.organizeByCategories ??
    true;
  const activeUsersCount = usersData.items?.length ?? 0;
  const participantsCount = activeUsersCount + (invites?.length ?? 0);

  const processName = decisionName || instance.name || '';

  if (!isReadyToLaunch) {
    const incompleteItems = checklist.filter((item) => !item.isValid);

    return (
      <div className="mx-auto flex w-full flex-col gap-6 p-4 md:max-w-160 md:p-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t('Summary')}</p>
          <Header2 className="font-serif text-title-base">
            {t('Your process still needs more information')}
          </Header2>
        </div>
        <p className="text-base text-foreground">
          {t.rich(
            '<highlight>{processName}</highlight> is missing information in order to go live.',
            {
              processName,
              highlight: (chunks: React.ReactNode) => (
                <span className="font-bold">{chunks}</span>
              ),
            },
          )}
        </p>
        <div className="flex flex-col space-y-2 rounded-lg border p-4">
          {incompleteItems.map((item, index) => (
            <div key={item.id}>
              <div className="flex items-center justify-between">
                <span className="text-base text-foreground">
                  {t(item.labelKey)}
                </span>
                <Button
                  variant="outline"
                  className="shrink-0"
                  onPress={() => {
                    const sectionId = checklistSectionMap[item.id];
                    if (sectionId) {
                      void setSectionParam(sectionId);
                    }
                  }}
                >
                  {t('Take me there')}
                </Button>
              </div>
              {index < incompleteItems.length - 1 && (
                <div className="mt-2 border-t border-border" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col gap-6 p-4 md:max-w-160 md:p-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{t('Summary')} 🚀</p>
        <Header2 className="font-serif text-title-base">
          {t('Review your process')}
        </Header2>
      </div>
      <p>
        {t.rich(
          '<highlight>{processName}</highlight> is ready to go live. Launching your process will invite and notify participants.',
          {
            processName,
            highlight: (chunks: React.ReactNode) => (
              <span className="font-bold">{chunks}</span>
            ),
          },
        )}
      </p>
      <p>{t('You can always edit and invite participants after launching.')}</p>
      <div className="flex flex-col space-y-2 rounded-lg border p-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-base text-muted-foreground">
              {t('Phases')}
            </span>
            <span className="text-base text-foreground">{phasesCount}</span>
          </div>
          <div className="mt-2 border-t border-border" />
        </div>
        {organizeByCategories && (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-base text-muted-foreground">
                {t('Categories')}
              </span>
              <span className="text-base text-foreground">
                {categories.length}
              </span>
            </div>
            <div className="mt-2 border-t border-border" />
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-base text-muted-foreground">
            {t('Participants Invited')}
          </span>
          <span className="text-base text-foreground">{participantsCount}</span>
        </div>
      </div>
    </div>
  );
}
