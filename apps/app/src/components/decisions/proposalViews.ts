import type { Proposal } from '@op/common/client';
import type { ReactNode } from 'react';

/**
 * The `?view=` URL contract for every proposal browse surface, in the order the
 * view toggle renders them: the masonry grid, the single-column reading feed,
 * then the map. Browse offers all of them.
 */
export const PROPOSAL_VIEWS = ['grid', 'feed', 'map'] as const;
export type ProposalView = (typeof PROPOSAL_VIEWS)[number];

/**
 * What the review queue offers: it renders assignment cards in a masonry or on
 * the map and has no feed renderer, so a `?view=feed` link from browse falls
 * back to the grid rather than showing an option nothing renders.
 */
export const REVIEW_ASSIGNMENT_VIEWS = ['grid', 'map'] as const;

/**
 * Renders one proposal in a view's card column. The view owns its own layout
 * policy (the map's active highlight, the feed's width), so it hands the card
 * the `className` carrying it. Shared so every view renders the same card.
 */
export type RenderProposalCard = (
  proposal: Proposal,
  opts: { className: string },
) => ReactNode;

export interface ProposalViewResolution {
  /** The views this surface can actually offer right now, in display order. */
  availableViews: ProposalView[];
  /** What renders with no `?view=` — stripped from the URL when selected. */
  defaultView: ProposalView;
  /** What to render now. Always one of `availableViews`. */
  effectiveView: ProposalView;
}

/**
 * Resolves which views a proposal surface offers and which one is showing.
 *
 * `views` is what the surface has a renderer for. `map` drops out on top of
 * that when the process collects no location, because there would be nothing
 * to plot. A `requestedView` outside what survives (a stale link, another
 * process's `?view=map`, a feed link opened on the review queue) falls back to
 * the default rather than rendering a view the surface can't draw.
 */
export const resolveProposalViews = ({
  views,
  hasLocationField,
  preferredView,
  requestedView,
}: {
  views: readonly ProposalView[];
  hasLocationField: boolean;
  /** The view to lead with when it is available. */
  preferredView: ProposalView;
  /** The `?view=` param, already parsed against `PROPOSAL_VIEWS`. */
  requestedView: ProposalView | null;
}): ProposalViewResolution => {
  const availableViews = views.filter(
    (view) => view !== 'map' || hasLocationField,
  );

  const defaultView = availableViews.includes(preferredView)
    ? preferredView
    : (availableViews[0] ?? 'grid');

  return {
    availableViews,
    defaultView,
    effectiveView:
      requestedView && availableViews.includes(requestedView)
        ? requestedView
        : defaultView,
  };
};
