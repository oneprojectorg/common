import type { ComponentProps } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface ProfileAvatarProps {
  /** Display name — seeds the fallback initial + gradient when no image. */
  name?: string | null;
  /** Resolved image URL. Callers resolve storage paths (e.g. getPublicUrl). */
  src?: string | null;
  /**
   * Accessible name for the avatar — normally the person's name. Applied to the
   * root, so it names the avatar whether the image renders or the fallback does.
   */
  alt: string;
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  /**
   * Element to render the image through — e.g. a Next.js `<Image>` — so
   * consumers keep image optimization. Forwarded to AvatarImage's `render`.
   */
  imageRender?: ComponentProps<typeof AvatarImage>['render'];
}

/**
 * Avatar with an image when available, initial/gradient fallback otherwise.
 *
 * `role="img"` + `aria-label` sit on the root rather than on the inner image,
 * because the fallback renders only a single initial — without this, an avatar
 * whose image is missing (or 404s) announces as "K", and two people whose names
 * share a first letter are indistinguishable. `img` makes its subtree
 * presentational, so the name is announced once in both paths.
 */
function ProfileAvatar({
  name,
  src,
  alt,
  size,
  className,
  imageRender,
}: ProfileAvatarProps) {
  // Callers legitimately pass `alt={profile.name ?? ''}`. An empty name on a
  // `role="img"` is a nameless image — worse than no role at all — so an
  // unnamed avatar stays decorative instead.
  const named = alt.trim().length > 0;

  return (
    <Avatar
      size={size}
      className={className}
      {...(named
        ? { role: 'img', 'aria-label': alt }
        : { 'aria-hidden': true })}
    >
      {src ? <AvatarImage src={src} alt={alt} render={imageRender} /> : null}
      <AvatarFallback name={name ?? undefined} />
    </Avatar>
  );
}

export { ProfileAvatar };
