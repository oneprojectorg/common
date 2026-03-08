'use client';

import { trpc } from '@op/api/client';
import { Sheet, SheetBody } from '@op/ui/Sheet';
import { useSidebar } from '@op/ui/Sidebar';
import { LuChevronRight, LuHouse, LuList } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { LocaleChooser } from '@/components/LocaleChooser';
import { UserAvatarMenu } from '@/components/SiteHeader';

import { SidebarNavItems } from './components/SidebarNavItems';
import { useProcessBuilderStore } from './stores/useProcessBuilderStore';
import { useNavigationConfig } from './useNavigationConfig';
import { usePhaseValidation } from './usePhaseValidation';
import { useProcessNavigation } from './useProcessNavigation';
import { useProcessPhases } from './useProcessPhases';
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
    <>
      <ProcessBuilderHeaderContent instanceId={instanceId} slug={slug} />
      <MobileSidebarWithProfile instanceId={instanceId} slug={slug} />
    </>
  );
};

const CreateModeHeader = () => {
  const t = useTranslations();

  return (
    <header className="relative sticky top-0 z-20 flex h-14 w-dvw shrink-0 items-center justify-between border-b bg-white">
      <div className="flex items-center gap-2 pl-4 md:pl-8">
        <Link href="/" className="flex items-center gap-2 text-neutral-black">
          <LuHouse className="size-4" />
          {t('Home')}
        </Link>
        <LuChevronRight className="size-4" />
        <LuList className="size-4 shrink-0" />
        <span>{t('New process')}</span>
      </div>
      <div className="flex items-center gap-3 pr-4 md:pr-8">
        <LocaleChooser />
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
      <div className="flex min-w-0 items-center gap-2 pl-4 md:pl-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-neutral-black"
        >
          <LuHouse className="size-4" />
          {t('Home')}
        </Link>
        <LuChevronRight className="size-4 shrink-0" />
        <LuList className="size-4 shrink-0" />
        <span className="truncate">{displayName}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3 pr-4 md:pr-8">
        <LocaleChooser />
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
  const navigationConfig = useNavigationConfig(instanceId);
  const { open, setOpen } = useSidebar();
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
    setOpen(false);
  };

  if (visibleSections.length === 0) {
    return null;
  }

  return (
    <Sheet
      isOpen={open}
      onOpenChange={setOpen}
      side="bottom"
      className="md:hidden"
    >
      <SheetBody>
        <nav className="flex flex-col gap-2 px-4 py-2">
          <SidebarNavItems
            visibleSections={visibleSections}
            phases={phases}
            currentSectionId={currentSection?.id}
            phaseValidation={phaseValidation}
            validationSections={validationSections}
            onSectionClick={handleSectionClick}
          />
        </nav>
      </SheetBody>
    </Sheet>
  );
};
