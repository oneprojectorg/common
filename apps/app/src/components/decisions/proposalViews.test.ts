import { describe, expect, it } from 'vitest';

import {
  PROPOSAL_VIEWS,
  REVIEW_ASSIGNMENT_VIEWS,
  VOTING_PROPOSAL_VIEWS,
  resolveProposalViews,
} from './proposalViews';

describe('resolveProposalViews', () => {
  it('offers every view the surface has, feed between grid and map, when the process collects a location', () => {
    const { availableViews, effectiveView } = resolveProposalViews({
      views: PROPOSAL_VIEWS,
      hasLocationField: true,
      preferredView: 'map',
      requestedView: null,
    });

    expect(availableViews).toEqual(['grid', 'feed', 'map']);
    expect(effectiveView).toBe('map');
  });

  it('drops the map when the process collects no location', () => {
    const { availableViews } = resolveProposalViews({
      views: PROPOSAL_VIEWS,
      hasLocationField: false,
      preferredView: 'grid',
      requestedView: null,
    });

    expect(availableViews).toEqual(['grid', 'feed']);
  });

  it('leads with the grid when the preferred view is a map the process has no field for', () => {
    const { defaultView, effectiveView } = resolveProposalViews({
      views: PROPOSAL_VIEWS,
      hasLocationField: false,
      preferredView: 'map',
      requestedView: null,
    });

    expect(defaultView).toBe('grid');
    expect(effectiveView).toBe('grid');
  });

  it('honours a requested view the surface offers', () => {
    const { effectiveView } = resolveProposalViews({
      views: PROPOSAL_VIEWS,
      hasLocationField: true,
      preferredView: 'map',
      requestedView: 'feed',
    });

    expect(effectiveView).toBe('feed');
  });

  it('falls back to the default when the surface has no renderer for the requested view', () => {
    const { availableViews, effectiveView } = resolveProposalViews({
      views: REVIEW_ASSIGNMENT_VIEWS,
      hasLocationField: true,
      preferredView: 'grid',
      requestedView: 'feed',
    });

    expect(availableViews).toEqual(['grid', 'map']);
    expect(effectiveView).toBe('grid');
  });

  it('offers no choice at all on the review queue when the process collects no location', () => {
    const { availableViews } = resolveProposalViews({
      views: REVIEW_ASSIGNMENT_VIEWS,
      hasLocationField: false,
      preferredView: 'grid',
      requestedView: null,
    });

    // Both surfaces hide the toggle on a single available view — this is the
    // only configuration that produces one.
    expect(availableViews).toEqual(['grid']);
  });

  it('sends a ?view=feed link carried into a voting phase back to the grid', () => {
    const { availableViews, effectiveView } = resolveProposalViews({
      views: VOTING_PROPOSAL_VIEWS,
      hasLocationField: false,
      preferredView: 'grid',
      requestedView: 'feed',
    });

    // The ballot lives in the grid, so the feed must not be reachable while
    // one is in play — a link saved before the phase turned over included.
    expect(availableViews).toEqual(['grid']);
    expect(effectiveView).toBe('grid');
  });

  it('falls back to the default for a stale ?view=map from another process', () => {
    const { effectiveView } = resolveProposalViews({
      views: PROPOSAL_VIEWS,
      hasLocationField: false,
      preferredView: 'grid',
      requestedView: 'map',
    });

    expect(effectiveView).toBe('grid');
  });
});
