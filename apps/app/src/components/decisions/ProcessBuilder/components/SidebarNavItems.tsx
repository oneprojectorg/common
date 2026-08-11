'use client';

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@op/sense/Sidebar';

import { useTranslations } from '@/lib/i18n';

import {
  type SectionId,
  type SidebarItem,
  isPhaseSection,
  isSectionId,
  phaseToSectionId,
} from '../navigationConfig';
import type { ProcessPhase } from '../useProcessPhases';

type StaticSidebarItem = Extract<SidebarItem, { isDynamic?: false }>;

interface SidebarNavItemsProps {
  visibleSections: SidebarItem[];
  phases: ProcessPhase[];
  currentSectionId: string | undefined;
  phaseValidation: Record<string, boolean>;
  validationSections: Record<SectionId, boolean>;
  onSectionClick: (sectionId: string) => void;
}

// Teal dot flagging a section that still needs configuration.
function IncompleteDot() {
  return <span className="size-1.5 shrink-0 rounded-full bg-primary" />;
}

// A single nav row built on the (context-free) sense SidebarMenuSubButton —
// `isActive` drives the sidebar-accent selected styling. Rendered as a
// <button> since these navigate in-page rather than following an href.
// justify-between keeps the incomplete dot at the trailing edge.
function NavRow({
  label,
  isActive,
  incomplete,
  onClick,
}: {
  label: string;
  isActive: boolean;
  incomplete: boolean;
  onClick: () => void;
}) {
  return (
    <SidebarMenuSubButton
      render={<button type="button" />}
      isActive={isActive}
      onClick={onClick}
      className="w-full cursor-pointer justify-between gap-2"
    >
      <span className="truncate">{label}</span>
      {incomplete && <IncompleteDot />}
    </SidebarMenuSubButton>
  );
}

export function SidebarNavItems({
  visibleSections,
  phases,
  currentSectionId,
  phaseValidation,
  validationSections,
  onSectionClick,
}: SidebarNavItemsProps) {
  const t = useTranslations();

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel className="text-sm text-muted-foreground">
        {t('Process Settings')}
      </SidebarGroupLabel>
      <SidebarMenu className="gap-1">
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
      </SidebarMenu>
    </SidebarGroup>
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

  return (
    <SidebarMenuItem>
      <NavRow
        label={t(section.labelKey)}
        isActive={currentSectionId === section.id}
        incomplete={
          isSectionId(section.id) && validationSections[section.id] === false
        }
        onClick={() => onSectionClick(section.id)}
      />
      {section.id === 'phases' && phases.length > 0 && (
        <SidebarMenuSub className="me-0 pe-0">
          {phases.map((phase) => (
            <PhaseItem
              key={phase.phaseId}
              phase={phase}
              currentSectionId={currentSectionId}
              phaseValidation={phaseValidation}
              onSectionClick={onSectionClick}
            />
          ))}
        </SidebarMenuSub>
      )}
      {childSections.length > 0 && (
        <SidebarMenuSub className="me-0 pe-0">
          {childSections.map((child) => (
            <SidebarMenuSubItem key={child.id}>
              <NavRow
                label={t(child.labelKey)}
                isActive={currentSectionId === child.id}
                incomplete={
                  isSectionId(child.id) &&
                  validationSections[child.id] === false
                }
                onClick={() => onSectionClick(child.id)}
              />
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
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
    <SidebarMenuSubItem>
      <NavRow
        label={phase.name || t('Untitled phase')}
        isActive={isActive}
        incomplete={phaseValidation[phase.phaseId] === false}
        onClick={() => onSectionClick(phaseSectionId)}
      />
    </SidebarMenuSubItem>
  );
}
