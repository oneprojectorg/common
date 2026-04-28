'use client';

import { Button } from '@op/ui/Button';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { ReactNode } from 'react';
import {
  LuArrowLeft,
  LuBookmark,
  LuHeart,
  LuPencil,
  LuStickyNote,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { useRouter } from '@/lib/i18n/routing';

import { LocaleChooser } from '../LocaleChooser';
import { UserAvatarMenu } from '../SiteHeader';

export function ProposalViewLayout({
  children,
  backHref,
  title,
  onLike,
  onFollow,
  isLiked = false,
  isFollowing = false,
  isLoading = false,
  editHref,
  canEdit = false,
  revisionToggle,
}: {
  children: ReactNode;
  backHref: string;
  title?: string;
  onLike?: () => void;
  onFollow?: () => void;
  isLiked?: boolean;
  isFollowing?: boolean;
  isLoading?: boolean;
  editHref?: string;
  canEdit?: boolean;
  /**
   * When provided, renders a sticky-note toggle button in the header with an
   * orange indicator dot. `isActive` reflects the aria-pressed state.
   */
  revisionToggle?: {
    onToggle: () => void;
    isActive: boolean;
  };
}) {
  const t = useTranslations();
  const router = useRouter();
  const revisionRequestLabel = t('Revision request');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="grid grid-cols-3 items-center border-b px-6 py-4">
        <button
          onClick={() => router.push(backHref)}
          className="flex cursor-pointer items-center gap-2 text-base text-primary-teal hover:text-primary-tealBlack"
        >
          <LuArrowLeft className="size-6 text-neutral-charcoal sm:size-4 sm:text-primary-teal" />
          <span className="hidden sm:block">{t('Back to Proposals')}</span>
        </button>

        <div className="flex justify-center text-lg font-medium text-neutral-black">
          {title ?? null}
        </div>

        <div className="flex items-center justify-end gap-4">
          {canEdit && editHref && (
            <Button
              color="secondary"
              surface="outline"
              size="small"
              onPress={() => router.push(editHref)}
              className="px-4 py-2"
            >
              <LuPencil className="h-4 w-4" />
              {t('Edit')}
            </Button>
          )}
          <Button
            surface={isLiked ? undefined : 'ghost'}
            color={isLiked ? 'verified' : 'secondary'}
            size="small"
            onPress={onLike}
            isDisabled={isLoading}
          >
            <LuHeart className="size-4" />
            {isLiked ? t('Liked') : t('Like')}
          </Button>
          <Button
            surface={isFollowing ? undefined : 'ghost'}
            color={isFollowing ? 'verified' : 'secondary'}
            size="small"
            onPress={onFollow}
          >
            <LuBookmark className="size-4" />

            {isFollowing ? t('Following') : t('Follow')}
          </Button>
          {revisionToggle && (
            <TooltipTrigger>
              <Button
                color="secondary"
                variant="icon"
                size="small"
                onPress={revisionToggle.onToggle}
                aria-label={revisionRequestLabel}
                aria-pressed={revisionToggle.isActive}
                className="relative size-8 min-w-8 rounded-sm p-0"
              >
                <LuStickyNote className="size-4" />
                <span
                  aria-hidden
                  className="absolute -end-0.5 -top-0.5 size-1.5 rounded-full bg-primary-orange2"
                />
              </Button>
              <Tooltip>{revisionRequestLabel}</Tooltip>
            </TooltipTrigger>
          )}
          <div className="hidden gap-4 sm:flex">
            <LocaleChooser />
            <UserAvatarMenu />
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
