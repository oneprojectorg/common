'use client';

import { Button } from '@op/ui/Button';
import { cn } from '@op/ui/utils';
import { ChevronLeft, Edit, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { LuBookmark } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { UserAvatarMenu } from '../SiteHeader';

interface ProposalViewLayoutProps {
  children: ReactNode;
  backHref: string;
  title: string;
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
          className="flex items-center gap-2 text-sm text-primary-teal hover:text-primary-tealBlack"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('Back to Proposals')}
        </button>

        <div className="flex-1 text-center text-lg font-medium text-neutral-black">
          {title ? title : t('Untitled Proposal')}
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
            surface="ghost"
            color="secondary"
            onPress={onLike}
            isDisabled={isLoading}
          >
            <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
            {isLiked ? t('Liked') : t('Like')}
          </Button>
          <Button color="secondary" onPress={onFollow}>
            <LuBookmark className={cn(isFollowing ? 'fill-current' : '')} />
            {isFollowing ? t('Following') : t('Follow')}
          </Button>
          <UserAvatarMenu />
        </div>
      </div>

      {children}
    </div>
  );
}
