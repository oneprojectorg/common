'use client';

import { getPublicUrl } from '@/utils';
import { useUser } from '@/utils/UserProvider';
import { formatCurrency, formatDate, parseProposalData } from '@/utils/proposalUtils';
import type { proposalEncoder } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Heart, MessageCircle, Users } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';

import { ProposalViewLayout } from './ProposalViewLayout';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalViewProps {
  proposal: Proposal;
  backHref: string;
}

export function ProposalView({ proposal, backHref }: ProposalViewProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  
  // Get current user to check edit permissions
  const { user } = useUser();
  
  // Check if current user can edit (only submitter can edit for now)
  const canEdit = Boolean(user?.currentProfile && proposal.submittedBy && user.currentProfile.id === proposal.submittedBy.id);
  
  // Generate edit href
  const editHref = canEdit ? `${backHref}/edit` : undefined;

  // Parse proposal data using shared utility
  const { title, budget, category, content } = parseProposalData(proposal.proposalData);

  // Memoize editor configuration for performance
  const editorConfig = useMemo(() => ({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: true, // Allow clicking links in view mode
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: content || '<p>No content available</p>',
    editable: false, // Make editor read-only
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-96 px-4 py-4',
      },
    },
    immediatelyRender: false,
  }), [content]);

  // Create read-only editor for content display
  const editor = useEditor(editorConfig);

  const handleLike = useCallback(() => {
    setIsLiked(!isLiked);
    // TODO: Implement like API call
  }, [isLiked]);

  const handleFollow = useCallback(() => {
    setIsFollowing(!isFollowing);
    // TODO: Implement follow API call
  }, [isFollowing]);


  if (!editor) {
    return (
      <ProposalViewLayout
        backHref={backHref}
        title={title || 'Untitled Proposal'}
        onLike={handleLike}
        onFollow={handleFollow}
        isLiked={isLiked}
        isFollowing={isFollowing}
        editHref={editHref}
        canEdit={canEdit}
      >
        <div className="flex flex-1 items-center justify-center">
          <div className="text-gray-500">Loading proposal...</div>
        </div>
      </ProposalViewLayout>
    );
  }

  return (
    <ProposalViewLayout
      backHref={backHref}
      title={title || 'Untitled Proposal'}
      onLike={handleLike}
      onFollow={handleFollow}
      isLiked={isLiked}
      isFollowing={isFollowing}
      editHref={editHref}
      canEdit={canEdit}
    >
      {/* Content */}
      <div className="flex-1 px-6 py-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {/* Title */}
          <h1 className="font-serif text-title-lg text-neutral-black">
            {title || 'Untitled Proposal'}
          </h1>

          {/* Metadata Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {budget && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-charcoal">Budget</span>
                  <span className="rounded-md bg-neutral-gray1 px-3 py-1 text-sm font-semibold text-neutral-charcoal">
                    {formatCurrency(budget)}
                  </span>
                </div>
              )}
              {category && (
                <span className="rounded-full bg-neutral-gray1 px-3 py-1 text-xs text-neutral-charcoal">
                  {category}
                </span>
              )}
            </div>
          </div>

          {/* Author and submission info */}
          <div className="flex items-center gap-3">
            {proposal.submittedBy && (
              <>
                <Avatar
                  placeholder={proposal.submittedBy.name || proposal.submittedBy.slug || 'U'}
                  className="h-8 w-8"
                >
                  {proposal.submittedBy.avatarImage?.name ? (
                    <Image
                      src={getPublicUrl(proposal.submittedBy.avatarImage.name) ?? ''}
                      alt={proposal.submittedBy.name || proposal.submittedBy.slug || ''}
                      fill
                      className="aspect-square object-cover"
                    />
                  ) : null}
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-neutral-charcoal">
                    {proposal.submittedBy.name || proposal.submittedBy.slug}
                  </span>
                  <span className="text-xs text-neutral-gray2">
                    Submitted on {formatDate(proposal.createdAt)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Engagement Stats */}
          <div className="flex items-center gap-6 border-b border-neutral-gray1 pb-4">
            <div className="flex items-center gap-1 text-sm text-neutral-gray2">
              <Heart className="h-4 w-4" />
              <span>0 Likes</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-neutral-gray2">
              <MessageCircle className="h-4 w-4" />
              <span>0 Comments</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-neutral-gray2">
              <Users className="h-4 w-4" />
              <span>1 Follower</span>
            </div>
          </div>

          {/* Proposal Content */}
          <div className="mt-6">
            <EditorContent
              className="[&>div]:px-0 [&>div]:py-0"
              editor={editor}
            />
          </div>
        </div>
      </div>
    </ProposalViewLayout>
  );
}