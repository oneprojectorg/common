'use client';

import { trpc } from '@op/api/client';
import { useMemo } from 'react';
import { LuCornerDownRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

import {
  isPhaseSection,
  isSectionId,
  phaseToSectionId,
} from './navigationConfig';
import { useProcessBuilderStore } from './stores/useProcessBuilderStore';
import { useNavigationConfig } from './useNavigationConfig';
import { useProcessNavigation } from './useProcessNavigation';
import { useProcessPhases } from './useProcessPhases';
import { isPhaseValid } from './validation/processBuilderValidation';
import { useProcessBuilderValidation } from './validation/useProcessBuilderValidation';

export const ProcessBuilderSidebar = ({
  instanceId,
  decisionProfileId,
}: {
  instanceId: string;
  decisionProfileId?: string;
}) => {
  const t = useTranslations();
  const navigationConfig = useNavigationConfig(instanceId);
  const { sections: validationSections } =
    useProcessBuilderValidation(decisionProfileId);

  const storePhases = useProcessBuilderStore((s) =>
    decisionProfileId ? s.instances[decisionProfileId]?.phases : undefined,
  );

  const { data: instance } = trpc.decision.getInstance.useQuery(
    { instanceId },
    { enabled: !!instanceId },
  );

  const phases = useProcessPhases(instanceId, decisionProfileId);

  const phaseValidation = useMemo(() => {
    const source = storePhases ?? instance?.instanceData?.phases ?? [];
    return Object.fromEntries(source.map((p) => [p.phaseId, isPhaseValid(p)]));
  }, [storePhases, instance]);

  const { visibleSections, currentSection, setSection } = useProcessNavigation(
    navigationConfig,
    phases,
  );

  return (
    <nav
      aria-label={t('Section navigation')}
      className="hidden shrink-0 md:sticky md:top-0 md:flex md:h-full md:w-60 md:flex-col md:overflow-y-auto md:border-r md:p-4"
    >
      <ul className="flex flex-col gap-1">
        {visibleSections
          .filter((section) => !section.isDynamic)
          .map((section) => {
            const isActive = currentSection?.id === section.id;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => setSection(section.id)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-left text-base transition-colors ${
                    isActive
                      ? 'bg-primary-tealWhite text-primary'
                      : 'text-neutral-black hover:bg-neutral-gray1'
                  }`}
                >
                  {t(section.labelKey as TranslationKey)}
                  {isSectionId(section.id) &&
                    validationSections[section.id] === false && (
                      <span className="size-1.5 shrink-0 rounded-full bg-primary-teal" />
                    )}
                </button>
                {section.id === 'phases' && phases.length > 0 && (
                  <ul className="mt-0.5 flex flex-col gap-0.5">
                    {phases.map((phase) => {
                      const phaseSectionId = phaseToSectionId(phase.phaseId);
                      const isPhaseActive =
                        currentSection?.id !== undefined &&
                        isPhaseSection(currentSection.id) &&
                        currentSection.id === phaseSectionId;
                      return (
                        <li key={phase.phaseId}>
                          <button
                            type="button"
                            onClick={() => setSection(phaseSectionId)}
                            className={`flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 text-left text-sm transition-colors ${
                              isPhaseActive
                                ? 'bg-primary-tealWhite text-primary'
                                : 'text-neutral-black hover:bg-neutral-gray1'
                            }`}
                          >
                            <LuCornerDownRight className="h-3 w-3 shrink-0 opacity-50" />
                            <span className="truncate">
                              {phase.name || t('Untitled phase')}
                            </span>
                            {phaseValidation[phase.phaseId] === false && (
                              <span className="ml-auto size-1.5 shrink-0 rounded-full bg-primary-teal" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
      </ul>
    </nav>
  );
};
