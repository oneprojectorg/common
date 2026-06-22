'use client';

import { formatDate } from '@/utils/formatting';
import type { ResourceInCollection } from '@op/api/encoders';
import { sanitizeUrl } from '@op/core/utils';
import { Surface } from '@op/ui/Surface';
import type { ComponentType } from 'react';
import { LuLink, LuPlay } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { iconComponentForMime } from './ResourceCard';
import { isVideoUrl } from './utils';

// Compact, read-only resource row for the decision overview sidebar. Documents
// reuse the mime-based icon from ResourceCard; links show a globe, or a play
// icon when the URL points at a known video host.
const iconForResource = (
  resource: ResourceInCollection,
): ComponentType<{ className?: string }> => {
  if (resource.type === 'document') {
    return iconComponentForMime(resource.attachment?.mimeType ?? null);
  }
  return isVideoUrl(resource.linkUrl) ? LuPlay : LuLink;
};

const hrefForResource = (
  resource: ResourceInCollection,
  signedUrl?: string | null,
): string | null => {
  if (resource.type === 'document') {
    return signedUrl ?? null;
  }
  return resource.linkUrl ? sanitizeUrl(resource.linkUrl) : null;
};

export const PinnedResourceCard = ({
  resource,
  signedUrl,
}: {
  resource: ResourceInCollection;
  signedUrl?: string | null;
}) => {
  const t = useTranslations();
  const Icon = iconForResource(resource);
  const href = hrefForResource(resource, signedUrl);
  const added = resource.createdAt
    ? t('Added {date}', { date: formatDate(resource.createdAt) })
    : null;

  const body = (
    <div className="flex items-center gap-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary-tealWhite">
        <Icon className="size-4 text-neutral-gray4" />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-base text-neutral-black">
          {resource.title}
        </p>
        {added ? (
          <p className="truncate text-sm text-neutral-gray4">{added}</p>
        ) : null}
      </div>
    </div>
  );

  return (
    <Surface className="rounded-lg p-2">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={resource.title}
          className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-teal focus-visible:ring-offset-2"
        >
          {body}
        </a>
      ) : (
        body
      )}
    </Surface>
  );
};
