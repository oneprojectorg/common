'use client';

import { useMemo } from 'react';
import { LuCornerDownRight } from 'react-icons/lu';

import { trpc } from '@op/api/client';
import { useTranslations } from '@/lib/i18n';

import { useNavigationConfig } from './useNavigationConfig';
import { useProcessNavigation } from './useProcessNavigation';

export const ProcessBuilderSidebar = ({
  instanceId,
}: {
  instanceId: string;
}) => {
  const t = useTranslations();
  const navigationConfig = useNavigationConfig(instanceId);
  const { visibleSections, currentSection, setSection } =
    useProcessNavigation(navigationConfig);

  const { data: instance } = trpc.decision.getInstance.useQuery(
    { instanceId },
    { enabled: !!instanceId },
  );

  const phases = useMemo(() => {
    const instancePhases = instance?.instanceData?.phases;
    if (instancePhases?.length) {
      return instancePhases
        .map((p) => ({ id: p.phaseId, name: p.name ?? '' }))
        .filter((p) => p.name);
    }
    const templatePhases = instance?.process?.processSchema?.phases;
    if (templatePhases?.length) {
      return templatePhases.map((p) => ({ id: p.id, name: p.name }));
    }
    return [];
  }, [instance]);

  return (
    <nav
      aria-label={t('Section navigation')}
      className="hidden shrink-0 md:sticky md:top-0 md:flex md:h-full md:w-60 md:flex-col md:overflow-y-auto md:border-r md:p-4"
    >
      <ul className="flex flex-col gap-1">
        {visibleSections.map((section) => {
          const isActive = currentSection?.id === section.id;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => setSection(section.id)}
                className={`w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-tealWhite text-primary font-medium'
                    : 'text-charcoal hover:bg-neutral-gray1'
                }`}
              >
                {t(section.labelKey)}
              </button>
              {section.id === 'phases' && phases.length > 0 && (
                <ul className="mt-0.5 flex flex-col gap-0.5">
                  {phases.map((phase) => (
                    <li key={phase.id}>
                      <button
                        type="button"
                        onClick={() => setSection('phases')}
                        className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-left text-xs text-charcoal transition-colors hover:bg-neutral-gray1"
                      >
                        <LuCornerDownRight className="h-3 w-3 shrink-0 opacity-50" />
                        <span className="truncate">{phase.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
