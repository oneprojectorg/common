'use client';

import type { InstancePhaseData } from '@op/api/encoders';
import { cn } from '@op/ui/utils';
import type { ReactNode } from 'react';

import { DecisionHeroBanner } from './DecisionHeroBanner';
import { EditBannerModal } from './EditBannerModal';

/**
 * Phase-page hero banner: shows the phase's own hero image, falling back to the
 * decision's overview banner, and gives admins the "Edit banner" control
 * (scoped to the phase). Wraps the DecisionHeroBanner chrome so the standard /
 * voting / review pages don't each re-derive the fallback + wrapper.
 *
 * `children` is a render prop receiving whether a banner image is showing, so
 * the hero content (DecisionHero, facepile, ...) can switch to white text
 * without recomputing the fallback.
 */
export function PhaseHeroBanner({
  instanceId,
  phase,
  overviewImagePath,
  isAdmin = false,
  className,
  children,
}: {
  instanceId: string;
  /** Current phase; supplies the per-phase image + id (the edit target). */
  phase?: InstancePhaseData;
  /** Overview banner, shown when the phase has no image of its own. */
  overviewImagePath?: string;
  isAdmin?: boolean;
  /** Extra classes for the inner max-w container (e.g. `items-center`). */
  className?: string;
  children: (hasImage: boolean) => ReactNode;
}) {
  const phaseImagePath = phase?.heroImage;
  const heroImagePath = phaseImagePath ?? overviewImagePath;
  const hasImage = Boolean(heroImagePath);

  return (
    <div className="relative">
      {isAdmin && phase?.phaseId ? (
        <EditBannerModal
          instanceId={instanceId}
          phaseId={phase.phaseId}
          heroImagePath={phaseImagePath}
        />
      ) : null}
      <DecisionHeroBanner heroImagePath={heroImagePath}>
        <div
          className={cn(
            'mx-auto flex max-w-3xl flex-col justify-center gap-4 px-4 pt-16 pb-8 md:pb-16',
            className,
          )}
        >
          {children(hasImage)}
        </div>
      </DecisionHeroBanner>
    </div>
  );
}
