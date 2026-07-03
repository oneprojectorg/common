import { getPublicUrl } from '@/utils';
import Image from 'next/image';
import { ReactNode } from 'react';

/**
 * Wraps a phase page's top banner with the admin-uploaded hero image — the
 * same blurred-photo + dark-scrim treatment as the overview hero
 * (OverviewHero in DecisionOverview.tsx). Renders children unwrapped when no
 * image is set, so imageless processes keep the plain banner.
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

  if (!heroImageUrl) {
    return <>{children}</>;
  }

  return (
    <section className="relative w-full overflow-hidden">
      <Image
        src={heroImageUrl}
        alt=""
        fill
        // 6px blur per design; scale-105 hides the translucent rim the blur
        // pulls in at the edges (section clips the overflow).
        className="scale-105 object-cover blur-[6px]"
        // Banner is above the fold — opt out of lazy-loading.
        priority
      />
      {/* Dark scrim so the white banner text stays legible over arbitrary
          photos. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-neutral-black/50"
      />
      <div className="relative z-10">{children}</div>
    </section>
  );
}
