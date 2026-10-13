'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo } from 'react';

import {
  DEFAULT_NAVIGATION_CONFIG,
  type NavigationConfig,
  SIDEBAR_ITEMS,
  STEPS,
  type SectionId,
  type SidebarItem,
  type StepId,
  isPhaseSection,
  isReviewPhaseSection,
  phaseToSectionId,
  reviewPhaseToSectionId,
} from './navigationConfig';

export interface PhaseNavItem {
  phaseId: string;
  name: string;
  isReview?: boolean;
}

export function useProcessNavigation(
  navigationConfig: NavigationConfig = DEFAULT_NAVIGATION_CONFIG,
  phases: PhaseNavItem[] = [],
  excludedSectionIds: string[] = [],
) {
  const perPhaseEnabled = useFeatureFlag('review_settings_per_phase');
  const [sectionParam, setSectionParam] = useQueryState('section', {
    history: 'push',
  });

  // Legacy params for backward compatibility
  const [legacyStepParam, setLegacyStepParam] = useQueryState('step', {
    history: 'replace',
  });

  // Filter SIDEBAR_ITEMS to only visible sections based on navigationConfig,
  // then insert dynamic phase sections after 'phases' and review phase
  // sections after 'reviewSettings'
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
      if (!allowedSectionIds.some((id) => id === item.id)) {
        return false;
      }
      // Section must not be explicitly excluded
      return !excludedSectionIds.includes(item.id);
    });

    const withPhases = insertAfter(
      filtered,
      'phases',
      phases.map((phase) => ({
        id: phaseToSectionId(phase.phaseId),
        labelKey: phase.name,
        parentStepId: 'general' as const,
        isDynamic: true,
      })),
    );

    if (!perPhaseEnabled) {
      return withPhases;
    }

    return insertAfter(
      withPhases,
      'reviewSettings',
      phases
        .filter((phase) => phase.isReview)
        .map((phase) => ({
          id: reviewPhaseToSectionId(phase.phaseId),
          labelKey: phase.name,
          parentStepId: 'reviews' as const,
          isDynamic: true,
        })),
    );
  }, [
    navigationConfig.steps,
    navigationConfig.sections,
    phases,
    excludedSectionIds,
    perPhaseEnabled,
  ]);

  // Backward compatibility: derive section from old step+section params
  useEffect(() => {
    if (legacyStepParam && !sectionParam) {
      // Old URL format: ?step=general&section=overview → ?section=overview
      // or just ?step=general → derive first section of that step
      setLegacyStepParam(null);
    }
  }, [legacyStepParam, sectionParam, setLegacyStepParam]);

  // Current section (fallback to last visible section if excluded, else first)
  const currentSection = useMemo(() => {
    const found = visibleSections.find((s) => s.id === sectionParam);
    if (found) {
      return found;
    }
    // If the current section was explicitly excluded, redirect to the last
    // visible section (e.g., when summary is hidden, go back to participants)
    if (sectionParam && excludedSectionIds.includes(sectionParam)) {
      return visibleSections[visibleSections.length - 1] ?? visibleSections[0];
    }
    return visibleSections[0];
  }, [sectionParam, visibleSections, excludedSectionIds]);

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

  // Replace invalid section param in URL (skip dynamic phase sections —
  // not all hook consumers receive the phases list, so phase-* IDs may be
  // absent from visibleSections without being truly invalid; reviewPhase-*
  // IDs also wait on the feature flag)
  useEffect(() => {
    if (
      sectionParam &&
      !visibleSections.some((s) => s.id === sectionParam) &&
      !isPhaseSection(sectionParam) &&
      !isReviewPhaseSection(sectionParam)
    ) {
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

function insertAfter(
  items: SidebarItem[],
  anchorId: string,
  inserted: SidebarItem[],
): SidebarItem[] {
  const index = items.findIndex((item) => item.id === anchorId);
  if (inserted.length === 0 || index === -1) {
    return items;
  }
  return [...items.slice(0, index + 1), ...inserted, ...items.slice(index + 1)];
}
