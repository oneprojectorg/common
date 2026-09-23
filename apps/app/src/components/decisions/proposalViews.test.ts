import { describe, expect, it } from 'vitest';

import { PROPOSAL_VIEWS, resolveProposalViews } from './proposalViews';

// What the review queue offers: it has no feed renderer.
const REVIEW_VIEWS = ['grid', 'map'] as const;

describe('PROPOSAL_VIEWS', () => {
  it('orders the feed between the grid and the map', () => {
    expect(PROPOSAL_VIEWS).toEqual(['grid', 'feed', 'map']);
  });
});

describe('resolveProposalViews', () => {
  it('offers every view the surface has when the process collects a location', () => {
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
      views: REVIEW_VIEWS,
      hasLocationField: true,
      preferredView: 'grid',
      requestedView: 'feed',
    });

    expect(availableViews).toEqual(['grid', 'map']);
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
