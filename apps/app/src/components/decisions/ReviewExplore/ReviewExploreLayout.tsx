import { ReviewExploreLayoutClient } from './ReviewExploreLayoutClient';

interface ReviewExploreLayoutProps {
  slug: string;
  reviewId: string;
}

export function ReviewExploreLayout({
  slug,
  reviewId,
}: ReviewExploreLayoutProps) {
  return <ReviewExploreLayoutClient slug={slug} reviewId={reviewId} />;
}
