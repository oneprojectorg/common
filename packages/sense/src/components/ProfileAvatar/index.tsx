import type { ComponentProps } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface ProfileAvatarProps {
  /** Display name — seeds the fallback initial + gradient when no image. */
  name?: string | null;
  /** Resolved image URL. Callers resolve storage paths (e.g. getPublicUrl). */
  src?: string | null;
  alt: string;
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  /**
   * Element to render the image through — e.g. a Next.js `<Image>` — so
   * consumers keep image optimization. Forwarded to AvatarImage's `render`.
   */
  imageRender?: ComponentProps<typeof AvatarImage>['render'];
}

/** Avatar with an image when available, initial/gradient fallback otherwise. */
function ProfileAvatar({
  name,
  src,
  alt,
  size,
  className,
  imageRender,
}: ProfileAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt={alt} render={imageRender} /> : null}
      <AvatarFallback name={name ?? undefined} />
    </Avatar>
  );
}

export { ProfileAvatar };
