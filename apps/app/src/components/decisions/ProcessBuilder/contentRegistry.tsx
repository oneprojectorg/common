'use client';

import { type ComponentType } from 'react';

import type { StepId } from './navigationConfig';
import OverviewSection from './stepContent/general/OverviewSection';
import PhasesSection from './stepContent/general/PhasesSection';
import ProposalCategoriesSection from './stepContent/general/ProposalCategoriesSection';
import ParticipantsSection from './stepContent/participants/ParticipantsSection';
import RolesSection from './stepContent/participants/RolesSection';
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
