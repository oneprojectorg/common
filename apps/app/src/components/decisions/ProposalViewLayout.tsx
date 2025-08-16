'use client';

import { Button } from '@op/ui/Button';
import { ChevronLeft, Heart, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';

import { UserAvatarMenu } from '../SiteHeader';

interface ProposalViewLayoutProps {
  children: ReactNode;
  backHref: string;
  title: string;
  onLike?: () => void;
  onFollow?: () => void;
  isLiked?: boolean;
  isFollowing?: boolean;
}

export function ProposalViewLayout({
  children,
  backHref,
  title,
  onLike,
  onFollow,
  isLiked = false,
  isFollowing = false,
}: ProposalViewLayoutProps) {
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
          Back to Proposals
        </button>

        <div className="flex-1 text-center text-lg font-medium text-neutral-black">
          {title ? title : 'Untitled Proposal'}
        </div>

        <div className="flex items-center gap-4">
          <Button
            color="primary"
            surface="outline"
            onPress={onLike}
            className="px-4 py-2"
          >
            <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
            Like
          </Button>
          <Button
            color="secondary"
            surface={isFollowing ? "solid" : "outline"}
            onPress={onFollow}
            className="px-4 py-2"
          >
            <Users className="h-4 w-4" />
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
          <UserAvatarMenu />
        </div>
      </div>

      {children}
    </div>
  );
}