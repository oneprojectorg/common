'use client';

import { useQueryState } from 'nuqs';
import { useCallback, useMemo } from 'react';

import {
  DEFAULT_VISIBILITY_CONFIG,
  SECTIONS_BY_STEP,
  STEPS,
  type SectionId,
  type StepId,
  type VisibilityConfig,
} from './navigation-config';

export function useProcessNavigation(
  visibilityConfig: VisibilityConfig = DEFAULT_VISIBILITY_CONFIG,
) {
  const [stepParam, setStepParam] = useQueryState('step');
  const [sectionParam, setSectionParam] = useQueryState('section');

  // Filter to visible steps only
  const visibleSteps = useMemo(
    () =>
      STEPS.filter((s) => {
        const visibility = visibilityConfig.steps?.[s.id];
        // Default to visible if not specified
        return visibility !== false;
      }),
    [visibilityConfig.steps],
  );

  // Current step (fallback to first visible step)
  const currentStep = useMemo(() => {
    const found = visibleSteps.find((s) => s.id === stepParam);
    return found ?? visibleSteps[0];
  }, [stepParam, visibleSteps]);

  // Get visible sections for current step
  const visibleSections = useMemo(() => {
    if (!currentStep) {
      return [];
    }

    const allSections = SECTIONS_BY_STEP[currentStep.id];
    const allowedSectionIds = visibilityConfig.sections?.[currentStep.id];

    // If no section config, show all sections for this step
    if (!allowedSectionIds) {
      return [...allSections];
    }

    // Filter to only allowed sections
    return allSections.filter((s) =>
      allowedSectionIds.includes(s.id as SectionId),
    );
  }, [currentStep, visibilityConfig.sections]);

  // Current section (fallback to first visible section)
  const currentSection = useMemo(() => {
    const found = visibleSections.find((s) => s.id === sectionParam);
    return found ?? visibleSections[0];
  }, [sectionParam, visibleSections]);

  // Handle step change - resets section to first of new step
  const setStep = useCallback(
    (newStepId: StepId | string) => {
      const newStep = visibleSteps.find((s) => s.id === newStepId);
      if (!newStep) {
        return;
      }

      // Get first section of the new step
      const newStepSections = SECTIONS_BY_STEP[newStep.id];
      const allowedSectionIds = visibilityConfig.sections?.[newStep.id];
      const firstVisibleSection = allowedSectionIds
        ? newStepSections.find((s) =>
            allowedSectionIds.includes(s.id as SectionId),
          )
        : newStepSections[0];

      setStepParam(newStepId);
      setSectionParam(firstVisibleSection?.id ?? null);
    },
    [visibleSteps, visibilityConfig.sections, setStepParam, setSectionParam],
  );

  // Handle section change
  const setSection = useCallback(
    (newSectionId: SectionId | string) => {
      setSectionParam(newSectionId);
    },
    [setSectionParam],
  );

  return {
    // Current state
    currentStep,
    currentSection,
    // Visible items
    visibleSteps,
    visibleSections,
    // Actions
    setStep,
    setSection,
  };
}
