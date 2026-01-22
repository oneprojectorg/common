'use client';

import { useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo } from 'react';

import {
  DEFAULT_NAVIGATION_CONFIG,
  type NavigationConfig,
  SECTIONS_BY_STEP,
  STEPS,
  type SectionId,
  type StepId,
} from './navigation-config';

export function useProcessNavigation(
  navigationConfig: NavigationConfig = DEFAULT_NAVIGATION_CONFIG,
) {
  const [stepParam, setStepParam] = useQueryState('step', { history: 'push' });
  const [sectionParam, setSectionParam] = useQueryState('section', {
    history: 'push',
  });

  // Filter to visible steps only
  const visibleSteps = useMemo(
    () =>
      STEPS.filter((s) => {
        const visibility = navigationConfig.steps?.[s.id];
        // Default to visible if not specified
        return visibility !== false;
      }),
    [navigationConfig.steps],
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
    const allowedSectionIds = navigationConfig.sections?.[currentStep.id];

    // If no section config, show all sections for this step
    if (!allowedSectionIds) {
      return [...allSections];
    }

    // Filter to only allowed sections
    return allSections.filter((s) =>
      allowedSectionIds.some((id) => id === s.id ),
    );
  }, [currentStep, navigationConfig.sections]);

  // Current section (fallback to first visible section)
  const currentSection = useMemo(() => {
    const found = visibleSections.find((s) => s.id === sectionParam);
    return found ?? visibleSections[0];
  }, [sectionParam, visibleSections]);

  // Replace invalid params in URL
  useEffect(() => {
    if (stepParam && !visibleSteps.some((s) => s.id === stepParam)) {
      setStepParam(null);
    }
    if (sectionParam && !visibleSections.some((s) => s.id === sectionParam)) {
      setSectionParam(currentSection?.id ?? null);
    }
  }, [
    stepParam,
    sectionParam,
    visibleSteps,
    visibleSections,
    currentSection,
    setStepParam,
    setSectionParam,
  ]);

  // Hide section param for single-section steps
  useEffect(() => {
    if (sectionParam && visibleSections.length <= 1) {
      setSectionParam(null);
    }
  }, [sectionParam, visibleSections.length, setSectionParam]);

  // Handle step change - resets section to first of new step
  const setStep = useCallback(
    (newStepId: StepId | string) => {
      const newStep = visibleSteps.find((s) => s.id === newStepId);
      if (!newStep) {
        return;
      }

      // Get first section of the new step
      const newStepSections = SECTIONS_BY_STEP[newStep.id];
      const allowedSectionIds = navigationConfig.sections?.[newStep.id];
      const firstVisibleSection = allowedSectionIds
        ? newStepSections.find((s) =>
            allowedSectionIds.some((id) => id === s.id ),
          )
        : newStepSections[0];

      setStepParam(newStepId);
      // Only set section param if step has multiple sections
      setSectionParam(
        newStepSections.length > 1 ? (firstVisibleSection?.id ?? null) : null,
      );
    },
    [visibleSteps, navigationConfig.sections, setStepParam, setSectionParam],
  );

  // Handle section change
  const setSection = useCallback(
    (newSectionId: string) => {
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
