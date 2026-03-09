'use client';

import { type ComponentType } from 'react';

import {
  type SectionId,
  type StepId,
  isPhaseSection,
} from './navigationConfig';
import OverviewSection from './stepContent/general/OverviewSection';
import PhaseDetailSection from './stepContent/general/PhaseDetailSection';
import PhasesSection from './stepContent/general/PhasesSection';
import ProposalCategoriesSection from './stepContent/general/ProposalCategoriesSection';
import ParticipantsSection from './stepContent/participants/ParticipantsSection';
import RolesSection from './stepContent/participants/RolesSection';
import SummarySectionContent from './stepContent/participants/SummarySectionContent';
import CriteriaSection from './stepContent/rubric/CriteriaSection';
import TemplateEditorSection from './stepContent/template/TemplateEditorSection';

// Props that all section components receive
export interface SectionProps {
  decisionProfileId: string;
  instanceId: string;
  decisionName: string;
}

type SectionComponent = ComponentType<SectionProps>;

// Registry structure - allows partial coverage
type ContentRegistry = {
  [S in StepId]?: Partial<Record<string, SectionComponent>>;
};

const CONTENT_REGISTRY: ContentRegistry = {
  general: {
    overview: OverviewSection,
    phases: PhasesSection,
    proposalCategories: ProposalCategoriesSection,
  },
  template: {
    templateEditor: TemplateEditorSection,
  },
  rubric: {
    criteria: CriteriaSection,
  },
  participants: {
    roles: RolesSection,
    participants: ParticipantsSection,
    summary: SummarySectionContent,
  },
};

export function getContentComponent(
  stepId: StepId | undefined,
  sectionId: string | undefined,
): SectionComponent | null {
  if (!stepId || !sectionId) {
    return null;
  }
  return CONTENT_REGISTRY[stepId]?.[sectionId] ?? null;
}

// Flat section-to-component mapping for the unified sidebar
const FLAT_CONTENT_REGISTRY: Record<string, SectionComponent> = {
  overview: OverviewSection,
  phases: PhasesSection,
  proposalCategories: ProposalCategoriesSection,
  templateEditor: TemplateEditorSection,
  criteria: CriteriaSection,
  roles: RolesSection,
  participants: ParticipantsSection,
  summary: SummarySectionContent,
};

export function getContentComponentFlat(
  sectionId: SectionId | string | undefined,
): SectionComponent | null {
  if (!sectionId) {
    return null;
  }
  if (isPhaseSection(sectionId)) {
    return PhaseDetailSection;
  }
  return FLAT_CONTENT_REGISTRY[sectionId] ?? null;
}
