'use client';

import { getPublicUrl } from '@/utils';
import { useUser } from '@/utils/UserProvider';
import {
  formatCurrency,
  formatDate,
  parseProposalData,
} from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Surface } from '@op/ui/Surface';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Heart, MessageCircle, Users } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

import { PostFeed, PostItem, usePostFeedActions } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';
import { ProposalViewLayout } from './ProposalViewLayout';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalViewProps {
  proposal: Proposal;
  backHref: string;
}

export function ProposalView({ proposal, backHref }: ProposalViewProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  // Get current user to check edit permissions
  const { user } = useUser();

  // Check if current user can edit (only submitter can edit for now)
  const canEdit = Boolean(
    user?.currentProfile &&
      proposal.submittedBy &&
      user.currentProfile.id === proposal.submittedBy.id,
  );

  // Generate edit href
  const editHref = canEdit
    ? `${backHref}/proposal/${proposal.id}/edit`
    : undefined;

  // Get comments for the proposal using the posts API
  const { data: commentsData, isLoading: commentsLoading } =
    trpc.posts.getPosts.useQuery({
      profileId: proposal.profileId || undefined,
      parentPostId: null, // Get top-level comments only
      limit: 50,
      offset: 0,
      includeChildren: false,
    });

  // Post feed actions for comments with profile-specific optimistic updates
  const { handleReactionClick } = usePostFeedActions({
    user,
    profileId: proposal.profileId || undefined, // Add profileId for optimistic updates
  });

  // Transform comments data to match PostToOrganization format expected by PostItem
  const comments = useMemo(
    () =>
      commentsData?.map((comment) => ({
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        deletedAt: null,
        postId: comment.id,
        organizationId: '', // Not needed for proposal comments
        post: comment,
        organization: null, // Comments don't need organization context
      })) || [],
    [commentsData],
  );

  // Function to scroll to show comments after adding a new one
  const scrollToComments = useCallback(() => {
    if (commentsContainerRef.current) {
      setTimeout(() => {
        const container = commentsContainerRef.current;
        if (container) {
          container.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest',
          });
        }
      }, 100);
    }
  }, []);

  // Parse proposal data using shared utility
  const { title, budget, category, content } = parseProposalData(
    proposal.proposalData,
  );

  // Memoize editor configuration for performance
  const editorConfig = useMemo(
    () => ({
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
          class:
            'prose prose-lg max-w-none focus:outline-none min-h-96 px-4 py-4',
        },
      },
      immediatelyRender: false,
    }),
    [content],
  );

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
                  <span className="text-sm font-medium text-neutral-charcoal">
                    Budget
                  </span>
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
                  placeholder={
                    proposal.submittedBy.name ||
                    proposal.submittedBy.slug ||
                    'U'
                  }
                  className="h-8 w-8"
                >
                  {proposal.submittedBy.avatarImage?.name ? (
                    <Image
                      src={
                        getPublicUrl(proposal.submittedBy.avatarImage.name) ??
                        ''
                      }
                      alt={
                        proposal.submittedBy.name ||
                        proposal.submittedBy.slug ||
                        ''
                      }
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
              <span>
                {comments.length} Comment{comments.length !== 1 ? 's' : ''}
              </span>
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

          {/* Comments Section */}
          <div className="mt-12" ref={commentsContainerRef}>
            <div className="border-t border-neutral-gray1 pt-8">
              <h3 className="mb-6 text-lg font-semibold text-neutral-charcoal">
                Comments ({comments.length})
              </h3>

              {/* Comment Input */}
              <div className="mb-8">
                <Surface className="border-0 p-0 sm:border sm:p-4">
                  <PostUpdate
                    profileId={proposal.profileId || undefined}
                    placeholder={`Comment${user?.currentProfile?.name ? ` as ${user?.currentProfile?.name}` : ''}...`}
                    label="Comment"
                    onSuccess={scrollToComments}
                  />
                </Surface>
              </div>

              {/* Comments Display */}
              {commentsLoading ? (
                <div
                  className="py-8 text-center text-gray-500"
                  role="status"
                  aria-label="Loading comments"
                >
                  Loading comments...
                </div>
              ) : comments.length > 0 ? (
                <div role="feed" aria-label={`${comments.length} comments`}>
                  <PostFeed>
                    {comments.map((comment, i) => (
                      <div key={comment.post.id}>
                        <PostItem
                          postToOrg={comment}
                          user={user}
                          withLinks={false}
                          onReactionClick={handleReactionClick}
                          className="sm:px-0"
                        />
                        {comments.length !== i + 1 && (
                          <hr className="my-4 bg-neutral-gray1" />
                        )}
                      </div>
                    ))}
                  </PostFeed>
                </div>
              ) : (
                <div
                  className="py-8 text-center text-gray-500"
                  role="status"
                  aria-label="No comments"
                >
                  No comments yet. Be the first to comment!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProposalViewLayout>
  );
}
