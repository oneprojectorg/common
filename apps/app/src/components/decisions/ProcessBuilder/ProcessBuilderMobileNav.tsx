'use client';

import { trpc } from '@op/api/client';
import { Sheet, SheetContent, SheetTitle } from '@op/sense/Sheet';
import { useSidebar } from '@op/sense/Sidebar';

import { useTranslations } from '@/lib/i18n';

import { SidebarNavItems } from './components/SidebarNavItems';
import { useNavigationConfig } from './useNavigationConfig';
import { usePhaseValidation } from './usePhaseValidation';
import { useProcessNavigation } from './useProcessNavigation';
import { useProcessPhases } from './useProcessPhases';
import { useProcessBuilderValidation } from './validation/useProcessBuilderValidation';

// The redesign drops the builder top bar (Home breadcrumb / process name /
// locale / avatar). The builder is now sidebar + content + footer only, so this
// renders just the mobile nav sheet that the footer's SidebarTrigger opens.
export const ProcessBuilderMobileNav = ({
  instanceId,
  slug,
}: {
  instanceId?: string;
  slug?: string;
}) => {
  if (!instanceId) {
    return null;
  }

  return <MobileSidebarWithProfile instanceId={instanceId} slug={slug} />;
};

const MobileSidebarWithProfile = ({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug?: string;
}) => {
  const { data: decisionProfile } = trpc.decision.getDecisionBySlug.useQuery(
    { slug: slug! },
    { enabled: !!slug },
  );
  return (
    <MobileSidebar
      instanceId={instanceId}
      decisionProfileId={decisionProfile?.id}
    />
  );
};

const MobileSidebar = ({
  instanceId,
  decisionProfileId,
}: {
  instanceId: string;
  decisionProfileId?: string;
}) => {
  const t = useTranslations();
  const navigationConfig = useNavigationConfig(instanceId, decisionProfileId);
  const { openMobile, setOpenMobile } = useSidebar();
  const { sections: validationSections } =
    useProcessBuilderValidation(decisionProfileId);
  const phases = useProcessPhases(instanceId, decisionProfileId);
  const phaseValidation = usePhaseValidation(instanceId, decisionProfileId);

  const { visibleSections, currentSection, setSection } = useProcessNavigation(
    navigationConfig,
    phases,
  );

  const handleSectionClick = (sectionId: string) => {
    setSection(sectionId);
    setOpenMobile(false);
  };

  if (visibleSections.length === 0) {
    return null;
  }

  return (
    <Sheet open={openMobile} onOpenChange={setOpenMobile}>
      <SheetContent side="bottom" showCloseButton={false} className="md:hidden">
        <SheetTitle className="sr-only">{t('Process steps')}</SheetTitle>
        <nav className="flex flex-col gap-2 p-4">
          <SidebarNavItems
            visibleSections={visibleSections}
            phases={phases}
            currentSectionId={currentSection?.id}
            phaseValidation={phaseValidation}
            validationSections={validationSections}
            onSectionClick={handleSectionClick}
          />
        </nav>
      </SheetContent>
    </Sheet>
  );
};
