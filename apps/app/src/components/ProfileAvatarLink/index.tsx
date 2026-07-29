import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { cn } from '@op/sense/lib/utils';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

/**
 * Focus/hover treatment for a circular avatar link. The ring sits on an offset
 * so it clears an inner separation ring (e.g. in a facepile) and reads clearly.
 * Exported so bare avatar links (e.g. a facepile "+N" bubble) match.
 */
export const avatarLinkClassName =
  // size-fit gives the link a definite size so a flex parent's align-items:
  // stretch can't stretch it taller than the avatar (which would oval the ring).
  'inline-flex size-fit rounded-full outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

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
 * render all over the app. Owns the circular focus ring, hover dim, and the
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
      className={cn(href && 'hover:opacity-80', className)}
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
    </Link>
  );
};
