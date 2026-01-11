'use client';

import { Button } from '@op/ui/Button';
import { Edit, Heart } from 'lucide-react';
import { ReactNode } from 'react';
import { LuArrowLeft, LuBookmark } from 'react-icons/lu';

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
}) {
  const t = useTranslations();
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="border-neutral-gray1 grid grid-cols-3 items-center border-b px-6 py-4">
        <button
          onClick={() => router.push(backHref)}
          className="text-primary-teal hover:text-primary-tealBlack flex items-center gap-2 text-base"
        >
          <LuArrowLeft className="sm:text-primary-teal text-neutral-charcoal size-6 sm:size-4" />
          <span className="hidden sm:block">{t('Back to Proposals')}</span>
        </button>

        <div className="text-neutral-black flex justify-center text-lg font-medium">
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
              <Edit className="h-4 w-4" />
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
            <Heart className="size-4" />
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
