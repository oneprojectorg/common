'use client';

import { type ComponentType } from 'react';

import type { StepId } from './navigation-config';
import MembersSection from './stepContent/members/MembersSection';
import RolesSection from './stepContent/members/RolesSection';
import OverviewSection from './stepContent/overview/OverviewSection';
import PhasesSection from './stepContent/overview/PhasesSection';
import ProposalCategoriesSection from './stepContent/overview/ProposalCategoriesSection';
import VotingSection from './stepContent/overview/VotingSection';
import CriteriaSection from './stepContent/rubric/CriteriaSection';
import SettingsSection from './stepContent/rubric/SettingsSection';
import FormBuilderSection from './stepContent/template/FormBuilderSection';

// Props that all section components receive
export interface SectionProps {
  decisionId: string;
  decisionName: string;
}

type SectionComponent = ComponentType<SectionProps>;

// Registry structure - allows partial coverage
type ContentRegistry = {
  [S in StepId]?: Partial<Record<string, SectionComponent>>;
};

const CONTENT_REGISTRY: ContentRegistry = {
  overview: {
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
