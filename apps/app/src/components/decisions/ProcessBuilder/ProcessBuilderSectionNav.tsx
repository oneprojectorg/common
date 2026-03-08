'use client';

import { useTranslations } from '@/lib/i18n';

import { SidebarNavItems } from './components/SidebarNavItems';
import { useNavigationConfig } from './useNavigationConfig';
import { usePhaseValidation } from './usePhaseValidation';
import { useProcessNavigation } from './useProcessNavigation';
import { useProcessPhases } from './useProcessPhases';
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
  const phases = useProcessPhases(instanceId, decisionProfileId);
  const phaseValidation = usePhaseValidation(instanceId, decisionProfileId);

  const { visibleSections, currentSection, setSection } = useProcessNavigation(
    navigationConfig,
    phases,
  );

  return (
    <nav
      aria-label={t('Section navigation')}
      className="hidden shrink-0 md:sticky md:top-0 md:flex md:h-full md:w-60 md:flex-col md:overflow-y-auto md:border-r md:p-4"
    >
      <SidebarNavItems
        visibleSections={visibleSections}
        phases={phases}
        currentSectionId={currentSection?.id}
        phaseValidation={phaseValidation}
        validationSections={validationSections}
        onSectionClick={setSection}
      />
    </nav>
  );
};
