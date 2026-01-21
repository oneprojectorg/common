'use client';

import { type ComponentType } from 'react';

import type { StepId } from './navigation-config';
import LimitsSection from './sections/categories/LimitsSection';
import TypesSection from './sections/categories/TypesSection';
// Direct imports (no lazy loading) - test if this fixes skeleton flash
import BasicsSection from './sections/overview/BasicsSection';
import PermissionsSection from './sections/overview/PermissionsSection';
import TimelineSection from './sections/overview/TimelineSection';
import DeliberationSection from './sections/phases/DeliberationSection';
import ReviewSection from './sections/phases/ReviewSection';
import SubmissionSection from './sections/phases/SubmissionSection';
import MethodSection from './sections/voting/MethodSection';
import QuorumSection from './sections/voting/QuorumSection';
import ResultsSection from './sections/voting/ResultsSection';

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
    basics: BasicsSection,
    timeline: TimelineSection,
    permissions: PermissionsSection,
  },
  phases: {
    submission: SubmissionSection,
    review: ReviewSection,
    deliberation: DeliberationSection,
  },
  categories: {
    types: TypesSection,
    limits: LimitsSection,
  },
  voting: {
    method: MethodSection,
    quorum: QuorumSection,
    results: ResultsSection,
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
