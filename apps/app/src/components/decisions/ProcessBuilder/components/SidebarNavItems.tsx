'use client';

import { cn } from '@op/ui/utils';

import { useTranslations } from '@/lib/i18n';

import {
  type SectionId,
  type SidebarItem,
  isPhaseSection,
  isSectionId,
  phaseToSectionId,
} from '../navigationConfig';
import type { ProcessPhase } from '../useProcessPhases';
import { CornerDownRight } from './CornerDownRight';

type StaticSidebarItem = Extract<SidebarItem, { isDynamic?: false }>;

interface SidebarNavItemsProps {
  visibleSections: SidebarItem[];
  phases: ProcessPhase[];
  currentSectionId: string | undefined;
  phaseValidation: Record<string, boolean>;
  validationSections: Record<SectionId, boolean>;
  onSectionClick: (sectionId: string) => void;
}

export function SidebarNavItems({
  visibleSections,
  phases,
  currentSectionId,
  phaseValidation,
  validationSections,
  onSectionClick,
}: SidebarNavItemsProps) {
  return (
    <ul className="flex flex-col gap-1">
      {visibleSections
        .filter(
          (section): section is StaticSidebarItem =>
            !section.isDynamic && !section.parentSectionId,
        )
        .map((section) => (
          <SectionItem
            key={section.id}
            section={section}
            childSections={visibleSections.filter(
              (s): s is StaticSidebarItem =>
                !s.isDynamic && s.parentSectionId === section.id,
            )}
            phases={phases}
            currentSectionId={currentSectionId}
            phaseValidation={phaseValidation}
            validationSections={validationSections}
            onSectionClick={onSectionClick}
          />
        ))}
    </ul>
  );
}

interface SectionItemProps {
  section: StaticSidebarItem;
  childSections: StaticSidebarItem[];
  phases: ProcessPhase[];
  currentSectionId: string | undefined;
  phaseValidation: Record<string, boolean>;
  validationSections: Record<SectionId, boolean>;
  onSectionClick: (sectionId: string) => void;
}

function SectionItem({
  section,
  childSections,
  phases,
  currentSectionId,
  phaseValidation,
  validationSections,
  onSectionClick,
}: SectionItemProps) {
  const t = useTranslations();
  const isActive = currentSectionId === section.id;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSectionClick(section.id)}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-base transition-colors',
          isActive
            ? 'bg-primary-tealWhite text-primary'
            : 'text-neutral-black hover:bg-neutral-gray1',
        )}
      >
        {t(section.labelKey)}
        {isSectionId(section.id) &&
          validationSections[section.id] === false && (
            <span className="size-1.5 shrink-0 rounded-full bg-primary-teal" />
          )}
      </button>
      {section.id === 'phases' && phases.length > 0 && (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {phases.map((phase) => (
            <PhaseItem
              key={phase.phaseId}
              phase={phase}
              currentSectionId={currentSectionId}
              phaseValidation={phaseValidation}
              onSectionClick={onSectionClick}
            />
          ))}
        </ul>
      )}
      {childSections.length > 0 && (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {childSections.map((child) => (
            <li key={child.id}>
              <button
                type="button"
                onClick={() => onSectionClick(child.id)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors',
                  currentSectionId === child.id
                    ? 'bg-primary-tealWhite text-primary'
                    : 'text-neutral-black hover:bg-neutral-gray1',
                )}
              >
                <CornerDownRight className="shrink-0 opacity-50" />
                <span className="truncate">{t(child.labelKey)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface PhaseItemProps {
  phase: ProcessPhase;
  currentSectionId: string | undefined;
  phaseValidation: Record<string, boolean>;
  onSectionClick: (sectionId: string) => void;
}

function PhaseItem({
  phase,
  currentSectionId,
  phaseValidation,
  onSectionClick,
}: PhaseItemProps) {
  const t = useTranslations();
  const phaseSectionId = phaseToSectionId(phase.phaseId);
  const isActive =
    currentSectionId !== undefined &&
    isPhaseSection(currentSectionId) &&
    currentSectionId === phaseSectionId;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSectionClick(phaseSectionId)}
        className={cn(
          'flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors',
          isActive
            ? 'bg-primary-tealWhite text-primary'
            : 'text-neutral-black hover:bg-neutral-gray1',
        )}
      >
        <CornerDownRight className="shrink-0 opacity-50" />
        <span className="truncate">{phase.name || t('Untitled phase')}</span>
        {phaseValidation[phase.phaseId] === false && (
          <span className="ml-auto size-1.5 shrink-0 rounded-full bg-primary-teal" />
        )}
      </button>
    </li>
  );
}
