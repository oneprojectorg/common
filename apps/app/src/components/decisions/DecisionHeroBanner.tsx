import { getPublicUrl } from '@/utils';
import Image from 'next/image';
import { ReactNode } from 'react';

import { EditBannerModal } from './EditBannerModal';

/**
 * Wraps a phase page's top banner with the admin-uploaded hero image — the
 * same blurred-photo + dark-scrim treatment as the overview hero
 * (OverviewHero in DecisionOverview.tsx, which shares
 * DecisionHeroBackgroundImage). Renders children unwrapped when no image is
 * set, so imageless processes keep the plain banner. Admins get the same
 * desktop "Edit banner" control as the overview hero.
 */
export function DecisionHeroBanner({
  instanceId,
  heroImagePath,
  isAdmin,
  children,
}: {
  instanceId: string;
  /** Stored storage path of the admin-uploaded hero image, if any. */
  heroImagePath?: string;
  /** Admins see the desktop "Edit banner" control on the banner. */
  isAdmin: boolean;
  children: ReactNode;
}) {
  const heroImageUrl = getPublicUrl(heroImagePath);

  return (
    <section className="relative w-full overflow-hidden bg-muted">
      {heroImageUrl && <DecisionHeroBackgroundImage imageUrl={heroImageUrl} />}
      <div className="relative z-10">{children}</div>
      {/* After the full-width content so the button stays clickable. */}
      {isAdmin ? (
        <EditBannerModal
          instanceId={instanceId}
          heroImagePath={heroImagePath}
        />
      ) : null}
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
      <div aria-hidden="true" className="absolute inset-0 bg-foreground/50" />
    </>
  );
}
