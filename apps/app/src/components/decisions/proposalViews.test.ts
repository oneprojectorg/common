import { describe, expect, it } from 'vitest';

import {
  PROPOSAL_VIEWS,
  REVIEW_ASSIGNMENT_VIEWS,
  BROWSE_VIEWS_WITHOUT_FEED,
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

  it('sends a ?view=feed link back to the grid where the feed is not offered', () => {
    const { availableViews, effectiveView } = resolveProposalViews({
      views: BROWSE_VIEWS_WITHOUT_FEED,
      hasLocationField: false,
      preferredView: 'grid',
      requestedView: 'feed',
    });

    // A ballot in play, or a phone: either way a link saved elsewhere must
    // land on a view this surface can draw and leave.
    expect(availableViews).toEqual(['grid']);
    expect(effectiveView).toBe('grid');
  });

  it('keeps leading with the map when the feed is dropped from a process that has one', () => {
    const { availableViews, effectiveView } = resolveProposalViews({
      views: BROWSE_VIEWS_WITHOUT_FEED,
      hasLocationField: true,
      preferredView: 'map',
      requestedView: 'feed',
    });

    expect(availableViews).toEqual(['grid', 'map']);
    expect(effectiveView).toBe('map');
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
