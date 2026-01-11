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
      <div className="px-6 py-4 grid grid-cols-3 items-center border-b">
        <button
          onClick={() => router.push(backHref)}
          className="gap-2 flex items-center text-base text-primary-teal hover:text-primary-tealBlack"
        >
          <LuArrowLeft className="sm:text-primary-teal size-6 sm:size-4 text-neutral-charcoal" />
          <span className="sm:block hidden">{t('Back to Proposals')}</span>
        </button>

        <div className="font-medium flex justify-center text-lg text-neutral-black">
          {title ?? null}
        </div>

        <div className="gap-4 flex items-center justify-end">
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
          <div className="gap-4 sm:flex hidden">
            <LocaleChooser />
            <UserAvatarMenu />
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
