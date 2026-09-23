'use client';

import type { MapDefaultView, ProposalTemplateSchema } from '@op/common/client';
import {
  getLocationFieldMapView,
  templateCollectsLocation,
} from '@op/common/client';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useCallback } from 'react';

import { DEFAULT_LOCATION_FIELD_MAP_VIEW } from './location/mapConfig';
import {
  PROPOSAL_VIEWS,
  type ProposalView,
  resolveProposalViews,
} from './proposalViews';

interface ProposalViewMode {
  /** Fallback camera for when no proposal has a location to fit. */
  mapView: MapDefaultView;
  /**
   * The views this surface is offering, in display order. Feed the toggle from
   * this, and hide it entirely when there is only one.
   */
  availableViews: ProposalView[];
  /** What to render now — always one of `availableViews`. */
  effectiveView: ProposalView;
  /**
   * The map is one of the offered views, so the floating `MobileViewSwitch`
   * exists and covers the small breakpoints the desktop toggle hides at.
   */
  hasMapView: boolean;
  isMapMode: boolean;
  handleViewChange: (next: ProposalView) => void;
}

/**
 * View state for a list of proposals, backed by the shared `?view=` query
 * param. Every surface offering the toggle derives it the same way, so the
 * location check and the URL contract can't drift apart.
 *
 * `views` is what this surface has a renderer for: browse offers all of
 * `PROPOSAL_VIEWS`, the review queue only grid and map. `defaultView` is the
 * one to lead with when it survives — browse passes `map` (users came for
 * places, not titles), the review queue passes `grid` (reviewing is sequential
 * work).
 */
export function useProposalViewMode(
  proposalTemplate: ProposalTemplateSchema | null | undefined,
  {
    defaultView: preferredView,
    views,
  }: { defaultView: ProposalView; views: readonly ProposalView[] },
): ProposalViewMode {
  // Nullable so the default below can depend on which views survive; the
  // contextual default is stripped from the URL in handleViewChange.
  const [requestedView, setView] = useQueryState(
    'view',
    parseAsStringLiteral(PROPOSAL_VIEWS),
  );

  const mapView =
    getLocationFieldMapView(proposalTemplate) ??
    DEFAULT_LOCATION_FIELD_MAP_VIEW;

  const { availableViews, defaultView, effectiveView } = resolveProposalViews({
    views,
    hasLocationField: templateCollectsLocation(proposalTemplate),
    preferredView,
    requestedView,
  });

  const handleViewChange = useCallback(
    (next: ProposalView) => {
      // Strip the param when picking the contextual default so the URL stays clean.
      void setView(next === defaultView ? null : next);
    },
    [setView, defaultView],
  );

  return {
    mapView,
    availableViews,
    effectiveView,
    hasMapView: availableViews.includes('map'),
    isMapMode: effectiveView === 'map',
    handleViewChange,
  };
}
