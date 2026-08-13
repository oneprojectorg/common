import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

/**
 * Focus/hover treatment for a circular avatar link. `group` + `relative` let a
 * child overlay tint on hover; the ring sits on an offset so it clears an inner
 * separation ring (e.g. in a facepile). Exported so bare avatar links (e.g. a
 * facepile "+N" bubble) match.
 */
export const avatarLinkClassName =
  // size-fit gives the link a definite size so a flex parent's align-items:
  // stretch can't stretch it taller than the avatar (which would oval the ring).
  'group relative inline-flex size-fit rounded-full outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Hover tint for a circular avatar link — a darkening overlay clipped to the
 * circle. Used instead of opacity so overlapping facepile avatars don't go
 * see-through and reveal their neighbor. Exported so bare avatar links match.
 */
export const AvatarLinkHoverTint = () => (
  <span
    aria-hidden
    className="pointer-events-none absolute inset-0 rounded-full bg-foreground/0 transition-colors duration-200 group-hover:bg-background/20"
  />
);

interface ProfileAvatarLinkProps {
  /** Destination. When omitted the avatar renders without a link. */
  href?: string | null;
  /** Display name — seeds the fallback initial + gradient when no image. */
  name?: string | null;
  /** Resolved image URL (callers resolve storage paths, e.g. getPublicUrl). */
  src?: string | null;
  alt: string;
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

/**
 * A `ProfileAvatar` wrapped in the locale-aware `Link` — the linked avatar we
 * render all over the app. Owns the circular focus ring, hover tint, and the
 * `next/image` passthrough so callers just supply `href`/`name`/`src`. Without
 * `href` it's a plain, non-interactive avatar.
 */
export const ProfileAvatarLink = ({
  href,
  name,
  src,
  alt,
  size,
  className,
}: ProfileAvatarLinkProps) => {
  const avatar = (
    <ProfileAvatar
      name={name}
      src={src}
      alt={alt}
      size={size}
      className={className}
      imageRender={
        src ? (
          <Image src={src} alt={alt} fill className="object-cover" />
        ) : undefined
      }
    />
  );

  if (!href) {
    return avatar;
  }

  return (
    <Link href={href} className={avatarLinkClassName}>
      {avatar}
      <AvatarLinkHoverTint />
    </Link>
  );
};
