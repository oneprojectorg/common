'use client';

import { useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo } from 'react';

import {
  DEFAULT_NAVIGATION_CONFIG,
  type NavigationConfig,
  SIDEBAR_ITEMS,
  type SidebarItem,
  STEPS,
  type SectionId,
  type StepId,
  phaseToSectionId,
} from './navigationConfig';

export interface PhaseNavItem {
  phaseId: string;
  name: string;
}

export function useProcessNavigation(
  navigationConfig: NavigationConfig = DEFAULT_NAVIGATION_CONFIG,
  phases: PhaseNavItem[] = [],
) {
  const [sectionParam, setSectionParam] = useQueryState('section', {
    history: 'push',
  });

  // Legacy params for backward compatibility
  const [legacyStepParam, setLegacyStepParam] = useQueryState('step', {
    history: 'replace',
  });

  // Filter SIDEBAR_ITEMS to only visible sections based on navigationConfig,
  // then insert dynamic phase sections after 'phases'
  const visibleSections = useMemo(() => {
    const filtered = SIDEBAR_ITEMS.filter((item) => {
      const stepId = item.parentStepId;
      if (!stepId) {
        return true;
      }
      // Step must be visible
      if (navigationConfig.steps?.[stepId] !== true) {
        return false;
      }
      // Section must be in allowed sections for its step
      const allowedSectionIds = navigationConfig.sections?.[stepId];
      if (!allowedSectionIds) {
        return false;
      }
      return allowedSectionIds.some((id) => id === item.id);
    });

    // Insert dynamic phase sections after 'phases' item
    if (phases.length === 0) {
      return filtered;
    }

    const phasesIndex = filtered.findIndex((item) => item.id === 'phases');
    if (phasesIndex === -1) {
      return filtered;
    }

    const phaseSections: SidebarItem[] = phases.map((phase) => ({
      id: phaseToSectionId(phase.phaseId),
      labelKey: phase.name,
      parentStepId: 'general' as const,
      isDynamic: true,
    }));

    return [
      ...filtered.slice(0, phasesIndex + 1),
      ...phaseSections,
      ...filtered.slice(phasesIndex + 1),
    ];
  }, [navigationConfig.steps, navigationConfig.sections, phases]);

  // Backward compatibility: derive section from old step+section params
  useEffect(() => {
    if (legacyStepParam && !sectionParam) {
      // Old URL format: ?step=general&section=overview → ?section=overview
      // or just ?step=general → derive first section of that step
      setLegacyStepParam(null);
    }
  }, [legacyStepParam, sectionParam, setLegacyStepParam]);

  // Current section (fallback to first visible section)
  const currentSection = useMemo(() => {
    const found = visibleSections.find((s) => s.id === sectionParam);
    return found ?? visibleSections[0];
  }, [sectionParam, visibleSections]);

  // Current index in visible sections for next/back navigation
  const currentIndex = useMemo(() => {
    if (!currentSection) {
      return 0;
    }
    const idx = visibleSections.findIndex((s) => s.id === currentSection.id);
    return idx === -1 ? 0 : idx;
  }, [currentSection, visibleSections]);

  const hasNext = currentIndex < visibleSections.length - 1;
  const hasPrev = currentIndex > 0;

  // Derive currentStep from currentSection's parentStepId (for backward compat with consumers)
  const currentStep = useMemo(() => {
    if (!currentSection?.parentStepId) {
      return STEPS[0];
    }
    return STEPS.find((s) => s.id === currentSection.parentStepId) ?? STEPS[0];
  }, [currentSection]);

  // Keep legacy visibleSteps for backward compat with header/sidebar consumers
  const visibleSteps = useMemo(
    () =>
      STEPS.filter((s) => {
        const visibility = navigationConfig.steps?.[s.id];
        return visibility === true;
      }),
    [navigationConfig.steps],
  );

  // Replace invalid section param in URL
  useEffect(() => {
    if (sectionParam && !visibleSections.some((s) => s.id === sectionParam)) {
      setSectionParam(currentSection?.id ?? null);
    }
  }, [sectionParam, visibleSections, currentSection, setSectionParam]);

  // Handle section change
  const setSection = useCallback(
    (newSectionId: SectionId | string) => {
      setSectionParam(newSectionId);
    },
    [setSectionParam],
  );

  // Handle step change - maps to first section of that step (backward compat for header tabs)
  const setStep = useCallback(
    (newStepId: StepId | string) => {
      const newStep = visibleSteps.find((s) => s.id === newStepId);
      if (!newStep) {
        return;
      }

      // Find first visible sidebar item belonging to this step
      const firstSection = visibleSections.find(
        (item) => item.parentStepId === newStep.id,
      );
      setSectionParam(firstSection?.id ?? null);
    },
    [visibleSteps, visibleSections, setSectionParam],
  );

  const goNext = useCallback(() => {
    if (hasNext) {
      setSectionParam(visibleSections[currentIndex + 1]!.id);
    }
  }, [hasNext, currentIndex, visibleSections, setSectionParam]);

  const goBack = useCallback(() => {
    if (hasPrev) {
      setSectionParam(visibleSections[currentIndex - 1]!.id);
    }
  }, [hasPrev, currentIndex, visibleSections, setSectionParam]);

  return {
    currentStep,
    currentSection,
    visibleSteps,
    visibleSections,
    setStep,
    setSection,
    goNext,
    goBack,
    hasNext,
    hasPrev,
  };
}
