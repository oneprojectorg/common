'use client';

import { type ComponentType } from 'react';

import type { StepId } from './navigationConfig';
import OverviewSection from './stepContent/general/OverviewSection';
import PhasesSection from './stepContent/general/PhasesSection';
import ProposalCategoriesSection from './stepContent/general/ProposalCategoriesSection';
import VotingSection from './stepContent/general/VotingSection';
import MembersSection from './stepContent/members/MembersSection';
import RolesSection from './stepContent/members/RolesSection';
import CriteriaSection from './stepContent/rubric/CriteriaSection';
import SettingsSection from './stepContent/rubric/SettingsSection';
import FormBuilderSection from './stepContent/template/FormBuilderSection';

// Props that all section components receive
export interface SectionProps {
  decisionProfileId: string;
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
    voting: VotingSection,
  },
  template: {
    formBuilder: FormBuilderSection,
  },
  rubric: {
    criteria: CriteriaSection,
    settings: SettingsSection,
  },
  members: {
    roles: RolesSection,
    members: MembersSection,
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
