'use client';

import { formatDate } from '@/utils/formatting';
import type { ResourceInCollection } from '@op/api/encoders';
import { sanitizeUrl } from '@op/core/utils';
import type { ComponentType } from 'react';
import { LuLink, LuPlay } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useDecisionTranslation } from '@/components/decisions/DecisionTranslationContext';

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
): string | undefined => {
  if (resource.type === 'document') {
    return signedUrl ?? undefined;
  }
  return resource.linkUrl ? sanitizeUrl(resource.linkUrl) : undefined;
};

export const PinnedResourceCard = ({
  resource,
  signedUrl,
}: {
  resource: ResourceInCollection;
  signedUrl?: string | null;
}) => {
  const t = useTranslations();
  const decisionTranslation = useDecisionTranslation();
  const title =
    decisionTranslation?.resources[resource.id]?.title ?? resource.title;
  const Icon = iconForResource(resource);
  const href = hrefForResource(resource, signedUrl);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={title}
      className="group block rounded-lg border p-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="flex items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-accent group-hover:bg-white">
          <Icon className="size-4 text-foreground" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p dir="auto" className="truncate text-base">
            {title}
          </p>
          {resource.createdAt ? (
            <p className="truncate text-sm text-muted-foreground">
              {t('Added {date}', { date: formatDate(resource.createdAt) })}
            </p>
          ) : null}
        </div>
      </div>
    </a>
  );
};
