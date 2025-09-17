'use client';

import { Button } from '@op/ui/Button';
import { Edit, Heart } from 'lucide-react';
import { ReactNode } from 'react';
import { LuArrowLeft, LuBookmark } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { useRouter } from '@/lib/i18n/routing';

import { LocaleChooser } from '../LocaleChooser';
import { UserAvatarMenu } from '../SiteHeader';

interface ProposalViewLayoutProps {
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
}

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
}: ProposalViewLayoutProps) {
  const t = useTranslations();
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-gray1 px-6 py-4">
        <button
          onClick={() => router.push(backHref)}
          className="flex items-center gap-2 text-base text-primary-teal hover:text-primary-tealBlack"
        >
          <LuArrowLeft className="size-6 stroke-1 text-neutral-charcoal sm:size-4 sm:text-primary-teal" />
          <span className="hidden sm:block">{t('Back to Proposals')}</span>
        </button>

        <div className="flex-1 text-center text-lg font-medium text-neutral-black">
          {title ?? null}
        </div>

        <div className="flex items-center gap-4">
          {canEdit && editHref && (
            <Button
              color="secondary"
              surface="outline"
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
            onPress={onLike}
            isDisabled={isLoading}
          >
            <Heart className="size-4" />
            {isLiked ? t('Liked') : t('Like')}
          </Button>
          <Button
            surface={isFollowing ? undefined : 'ghost'}
            color={isFollowing ? 'verified' : 'secondary'}
            onPress={onFollow}
          >
            <LuBookmark className="size-4" />
            {isFollowing ? t('Following') : t('Follow')}
          </Button>
          <div className="flex gap-4">
            <LocaleChooser />
            <UserAvatarMenu />
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
