import { getPublicUrl } from '@/utils';
import Image from 'next/image';
import { ReactNode } from 'react';

/**
 * Wraps a phase page's top banner with the admin-uploaded hero image — the
 * same blurred-photo + dark-scrim treatment as the overview hero
 * (OverviewHero in DecisionOverview.tsx, which shares
 * DecisionHeroBackgroundImage). Renders children unwrapped when no image is
 * set, so imageless processes keep the plain banner.
 */
export function DecisionHeroBanner({
  heroImagePath,
  children,
}: {
  /** Stored storage path of the admin-uploaded hero image, if any. */
  heroImagePath?: string;
  children: ReactNode;
}) {
  const heroImageUrl = getPublicUrl(heroImagePath);

  return (
    <section className="relative w-full overflow-hidden bg-muted">
      {heroImageUrl && <DecisionHeroBackgroundImage imageUrl={heroImageUrl} />}
      <div className="relative z-10">{children}</div>
    </section>
  );
}

/**
 * The hero banner background: blurred full-bleed photo behind a dark scrim.
 * Must sit inside a `relative overflow-hidden` container; the container's
 * content needs `relative z-10` to stay above the scrim.
 */
export function DecisionHeroBackgroundImage({
  imageUrl,
}: {
  imageUrl: string;
}) {
  return (
    <>
      <Image
        src={imageUrl}
        alt=""
        fill
        // 6px blur per design; scale-105 hides the translucent rim the blur
        // pulls in at the edges (the container clips the overflow).
        className="scale-105 object-cover blur-[6px]"
        // The banner is above the fold — opt out of lazy-loading.
        priority
      />
      {/* Dark scrim so the white banner text stays legible over arbitrary
          photos. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-neutral-black/50"
      />
    </>
  );
}
