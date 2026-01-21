'use client';

import { type ComponentType, lazy } from 'react';

import type { StepId } from './navigation-config';

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
    basics: lazy(() => import('./sections/overview/BasicsSection')),
    timeline: lazy(() => import('./sections/overview/TimelineSection')),
    permissions: lazy(() => import('./sections/overview/PermissionsSection')),
  },
  phases: {
    submission: lazy(() => import('./sections/phases/SubmissionSection')),
    review: lazy(() => import('./sections/phases/ReviewSection')),
    deliberation: lazy(() => import('./sections/phases/DeliberationSection')),
  },
  categories: {
    types: lazy(() => import('./sections/categories/TypesSection')),
    limits: lazy(() => import('./sections/categories/LimitsSection')),
  },
  voting: {
    method: lazy(() => import('./sections/voting/MethodSection')),
    quorum: lazy(() => import('./sections/voting/QuorumSection')),
    results: lazy(() => import('./sections/voting/ResultsSection')),
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
