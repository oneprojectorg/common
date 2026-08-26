'use client';

import type { MapDefaultView, ProposalTemplateSchema } from '@op/common/client';
import {
  getLocationFieldMapView,
  templateCollectsLocation,
} from '@op/common/client';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useCallback } from 'react';

import { PROPOSAL_VIEWS, type ProposalView } from './ProposalViewToggle';
import { DEFAULT_LOCATION_FIELD_MAP_VIEW } from './location/mapConfig';

interface ProposalViewMode {
  /** The process collects a location — the only case where the map view (and
   * its toggle) is offered at all. */
  hasLocationField: boolean;
  /** Fallback camera for when no proposal has a location to fit. */
  mapView: MapDefaultView;
  /** What to render now — never `map` without a location field. */
  effectiveView: ProposalView;
  isMapMode: boolean;
  handleViewChange: (next: ProposalView) => void;
}

/**
 * Grid/map view state for a list of proposals, backed by the shared `?view=`
 * query param. Every surface offering the toggle derives it the same way, so
 * the location check and the URL contract can't drift apart.
 *
 * `defaultView` is the view to lead with when the process has a map: browse
 * passes `map` (users came for places, not titles), the review queue passes
 * `grid` (reviewing is sequential work). Without a map field it's always the
 * grid, which also ignores a stale `?view=map` from another process.
 */
export function useProposalViewMode(
  proposalTemplate: ProposalTemplateSchema | null | undefined,
  { defaultView: preferredView }: { defaultView: ProposalView },
): ProposalViewMode {
  // Nullable so the default below can depend on whether the process collects a
  // location; the contextual default is stripped from the URL in setView.
  const [view, setView] = useQueryState(
    'view',
    parseAsStringLiteral(PROPOSAL_VIEWS),
  );

  const hasLocationField = templateCollectsLocation(proposalTemplate);
  const mapView =
    getLocationFieldMapView(proposalTemplate) ??
    DEFAULT_LOCATION_FIELD_MAP_VIEW;

  const defaultView: ProposalView = hasLocationField ? preferredView : 'grid';
  const effectiveView: ProposalView = hasLocationField
    ? (view ?? defaultView)
    : 'grid';

  const handleViewChange = useCallback(
    (next: ProposalView) => {
      // Strip the param when picking the contextual default so the URL stays clean.
      void setView(next === defaultView ? null : next);
    },
    [setView, defaultView],
  );

  return {
    hasLocationField,
    mapView,
    effectiveView,
    // `effectiveView` is forced to 'grid' without a location field, so it being
    // 'map' already implies one.
    isMapMode: effectiveView === 'map',
    handleViewChange,
  };
}
