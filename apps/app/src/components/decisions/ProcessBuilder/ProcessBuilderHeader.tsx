'use client';

import { trpc } from '@op/api/client';
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@op/ui/Sidebar';
import { useMemo } from 'react';
import { LuChevronRight, LuCornerDownRight, LuHouse } from 'react-icons/lu';

import { Link, type TranslationKey, useTranslations } from '@/lib/i18n';

import { UserAvatarMenu } from '@/components/SiteHeader';

import { isPhaseSection, phaseToSectionId } from './navigationConfig';
import { useProcessBuilderStore } from './stores/useProcessBuilderStore';
import { useNavigationConfig } from './useNavigationConfig';
import { useProcessNavigation } from './useProcessNavigation';
import { useProcessBuilderValidation } from './validation/useProcessBuilderValidation';

export const ProcessBuilderHeader = ({
  instanceId,
  slug,
}: {
  instanceId?: string;
  slug?: string;
}) => {
  if (!instanceId) {
    return <CreateModeHeader />;
  }

  return (
    <SidebarProvider>
      <ProcessBuilderHeaderContent instanceId={instanceId} slug={slug} />
      <MobileSidebarWithProfile instanceId={instanceId} slug={slug} />
    </SidebarProvider>
  );
};

const CreateModeHeader = () => {
  const t = useTranslations();

  return (
    <header className="relative sticky top-0 z-20 flex h-14 w-dvw shrink-0 items-center justify-between border-b bg-white">
      <div className="flex items-center gap-2 pl-4 md:pl-8">
        <Link
          href="/"
          className="hidden items-center gap-2 text-primary md:flex"
        >
          <LuHouse className="size-4" />
          {t('Home')}
        </Link>
        <LuChevronRight className="hidden size-4 md:block" />
        <span>{t('New process')}</span>
      </div>
      <div className="pr-4 md:pr-8">
        <UserAvatarMenu className="hidden md:block" />
      </div>
    </header>
  );
};

const ProcessBuilderHeaderContent = ({
  slug,
}: {
  instanceId: string;
  slug?: string;
}) => {
  const t = useTranslations();

  const { data: decisionProfile } = trpc.decision.getDecisionBySlug.useQuery(
    { slug: slug! },
    { enabled: !!slug },
  );

  const decisionProfileId = decisionProfile?.id;

  const storeData = useProcessBuilderStore((s) =>
    decisionProfileId ? s.instances[decisionProfileId] : undefined,
  );
  const displayName =
    storeData?.name || decisionProfile?.name || t('New process');

  return (
    <header className="relative sticky top-0 z-20 flex h-14 w-dvw shrink-0 items-center justify-between border-b bg-white">
      <div className="flex items-center gap-2 pl-4 md:pl-8">
        <SidebarTrigger className="size-4 sm:hidden" />
        <Link
          href="/"
          className="hidden items-center gap-2 text-primary sm:flex"
        >
          <LuHouse className="size-4" />
          {t('Home')}
        </Link>
        <LuChevronRight className="hidden size-4 sm:block" />
        <span className="truncate">{displayName}</span>
      </div>
      <div className="pr-4 md:pr-8">
        <UserAvatarMenu className="hidden sm:block" />
      </div>
    </header>
  );
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
  const navigationConfig = useNavigationConfig(instanceId);
  const { setOpen } = useSidebar();
  const { sections: validationSections } =
    useProcessBuilderValidation(decisionProfileId);
  const storePhases = useProcessBuilderStore((s) =>
    decisionProfileId ? s.instances[decisionProfileId]?.phases : undefined,
  );

  const { data: instance } = trpc.decision.getInstance.useQuery(
    { instanceId },
    { enabled: !!instanceId },
  );

  const phases = useMemo(() => {
    // Prefer Zustand store phases (updated immediately on edit) over API data
    if (storePhases?.length) {
      return storePhases
        .map((p) => ({ phaseId: p.phaseId, name: p.name ?? '' }))
        .filter((p) => p.name);
    }
    const instancePhases = instance?.instanceData?.phases;
    if (instancePhases?.length) {
      return instancePhases
        .map((p) => ({ phaseId: p.phaseId, name: p.name ?? '' }))
        .filter((p) => p.name);
    }
    const templatePhases = instance?.process?.processSchema?.phases;
    if (templatePhases?.length) {
      return templatePhases.map((p) => ({ phaseId: p.id, name: p.name }));
    }
    return [];
  }, [storePhases, instance]);

  const { visibleSections, currentSection, setSection } = useProcessNavigation(
    navigationConfig,
    phases,
  );

  const handleSectionClick = (sectionId: string) => {
    setSection(sectionId);
    setOpen(false);
  };

  if (visibleSections.length === 0) {
    return null;
  }

  return (
    <Sidebar mobileOnly>
      <nav className="flex flex-col gap-2 px-4 py-2">
        <Link href="/" className="flex h-8 items-center gap-2 px-4">
          <LuHouse className="size-4" />
          {t('Home')}
        </Link>
        <hr />

        <ul className="flex flex-col gap-1">
          {visibleSections
            .filter((section) => !section.isDynamic)
            .map((section) => {
              const isActive = currentSection?.id === section.id;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => handleSectionClick(section.id)}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-left text-base transition-colors ${
                      isActive
                        ? 'bg-primary-tealWhite text-primary'
                        : 'text-neutral-black hover:bg-neutral-gray1'
                    }`}
                  >
                    {t(section.labelKey as TranslationKey)}
                    {validationSections[section.id as keyof typeof validationSections] === false && (
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
                              onClick={() => handleSectionClick(phaseSectionId)}
                              className={`flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 text-left text-sm transition-colors ${
                                isPhaseActive
                                  ? 'bg-primary-tealWhite text-primary'
                                  : 'text-neutral-black hover:bg-neutral-gray1'
                              }`}
                            >
                              <LuCornerDownRight className="h-3 w-3 shrink-0 opacity-50" />
                              <span className="truncate">{phase.name}</span>
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
    </Sidebar>
  );
};
