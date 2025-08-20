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
import { ProfileRelationshipType } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Surface } from '@op/ui/Surface';
import Blockquote from '@tiptap/extension-blockquote';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import TiptapImage from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Strike from '@tiptap/extension-strike';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Heart, MessageCircle, Users } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useMemo, useRef } from 'react';
import { z } from 'zod';

import { PostFeed, PostItem, usePostFeedActions } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';
import { IframelyExtension } from './IframelyExtension';
import { ProposalViewLayout } from './ProposalViewLayout';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalViewProps {
  proposal: Proposal;
  backHref: string;
}

export function ProposalView({ proposal: initialProposal, backHref }: ProposalViewProps) {
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // Use a client-side query to get real-time updates, with initial data from server
  const { data: proposal } = trpc.decision.getProposal.useQuery(
    { proposalId: initialProposal.id },
    { 
      initialData: initialProposal,
      refetchOnMount: false, // Don't refetch on mount since we have initial data
      staleTime: 0, // Consider data stale immediately to allow cache updates to take effect
    }
  );

  // Safety check - fallback to initial data if query returns undefined
  const currentProposal = proposal || initialProposal;

  // Get current user to check edit permissions
  const { user } = useUser();

  // Direct tRPC mutations for like/follow functionality with optimistic updates
  const addRelationshipMutation = trpc.profile.addRelationship.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await utils.decision.getProposal.cancel({ proposalId: currentProposal.id });

      // Snapshot the previous value
      const previousData = utils.decision.getProposal.getData({ proposalId: currentProposal.id });

      // Optimistically update the cache
      if (previousData) {
        const optimisticData = { ...previousData };
        if (variables.relationshipType === ProfileRelationshipType.LIKES) {
          optimisticData.isLikedByUser = true;
        } else if (variables.relationshipType === ProfileRelationshipType.FOLLOWING) {
          optimisticData.isFollowedByUser = true;
        }
        utils.decision.getProposal.setData({ proposalId: currentProposal.id }, optimisticData);
      }

      return { previousData };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        utils.decision.getProposal.setData({ proposalId: currentProposal.id }, context.previousData);
      }
      console.error('Failed to add relationship:', error);
    },
    onSettled: () => {
      // Always refetch after error or success
      utils.decision.getProposal.invalidate({ proposalId: currentProposal.id });
      utils.decision.listProposals.invalidate(); // Also invalidate list to keep ProposalCard in sync
    },
  });

  const removeRelationshipMutation = trpc.profile.removeRelationship.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await utils.decision.getProposal.cancel({ proposalId: currentProposal.id });

      // Snapshot the previous value
      const previousData = utils.decision.getProposal.getData({ proposalId: currentProposal.id });

      // Optimistically update the cache
      if (previousData) {
        const optimisticData = { ...previousData };
        if (variables.relationshipType === ProfileRelationshipType.LIKES) {
          optimisticData.isLikedByUser = false;
        } else if (variables.relationshipType === ProfileRelationshipType.FOLLOWING) {
          optimisticData.isFollowedByUser = false;
        }
        utils.decision.getProposal.setData({ proposalId: currentProposal.id }, optimisticData);
      }

      return { previousData };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        utils.decision.getProposal.setData({ proposalId: currentProposal.id }, context.previousData);
      }
      console.error('Failed to remove relationship:', error);
    },
    onSettled: () => {
      // Always refetch after error or success
      utils.decision.getProposal.invalidate({ proposalId: currentProposal.id });
      utils.decision.listProposals.invalidate(); // Also invalidate list to keep ProposalCard in sync
    },
  });

  // Check if current user can edit (only submitter can edit for now)
  const canEdit = Boolean(
    user?.currentProfile &&
    currentProposal.submittedBy &&
    user.currentProfile.id === currentProposal.submittedBy.id,
  );

  // Generate edit href
  const editHref = canEdit
    ? `${backHref}/proposal/${currentProposal.id}/edit`
    : undefined;

  // Get comments for the proposal using the posts API
  const { data: commentsData, isLoading: commentsLoading } =
    trpc.posts.getPosts.useQuery({
      profileId: currentProposal.profileId || undefined,
      parentPostId: null, // Get top-level comments only
      limit: 50,
      offset: 0,
      includeChildren: false,
    });

  // Post feed actions for comments with profile-specific optimistic updates
  const { handleReactionClick } = usePostFeedActions({
    user,
    profileId: currentProposal.profileId || undefined, // Add profileId for optimistic updates
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
    currentProposal.proposalData,
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
        TiptapImage.configure({
          inline: true,
          allowBase64: true,
        }),
        Heading.configure({
          levels: [1, 2, 3],
        }),
        Underline,
        Strike,
        Blockquote,
        HorizontalRule,
        IframelyExtension,
      ],
      content: content || '<p>No content available</p>',
      editable: false, // Make editor read-only
      editorProps: {
        attributes: {
          class:
            'prose prose-lg max-w-none focus:outline-none px-6 py-6 text-neutral-black',
        },
      },
      immediatelyRender: false,
    }),
    [content],
  );

  // Create read-only editor for content display
  const editor = useEditor(editorConfig);

  const isLoading = addRelationshipMutation.isPending || removeRelationshipMutation.isPending;

  const handleLike = useCallback(async () => {
    console.log('handleLike called', { 
      profileId: currentProposal.profileId, 
      isLikedByUser: currentProposal.isLikedByUser 
    });

    if (!currentProposal.profileId) {
      console.error('No profileId provided for like action');
      return;
    }

    try {
      if (currentProposal.isLikedByUser) {
        console.log('Unliking proposal...');
        // Unlike
        await removeRelationshipMutation.mutateAsync({
          targetProfileId: currentProposal.profileId,
          relationshipType: ProfileRelationshipType.LIKES,
        });
      } else {
        console.log('Liking proposal...');
        // Like
        await addRelationshipMutation.mutateAsync({
          targetProfileId: currentProposal.profileId,
          relationshipType: ProfileRelationshipType.LIKES,
          pending: false,
        });
      }
    } catch (error) {
      console.error('Error in handleLike:', error);
    }
  }, [currentProposal.profileId, currentProposal.isLikedByUser, addRelationshipMutation, removeRelationshipMutation]);

  const handleFollow = useCallback(async () => {
    if (!currentProposal.profileId) {
      console.error('No profileId provided for follow action');
      return;
    }

    if (currentProposal.isFollowedByUser) {
      // Unfollow
      await removeRelationshipMutation.mutateAsync({
        targetProfileId: currentProposal.profileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
      });
    } else {
      // Follow
      await addRelationshipMutation.mutateAsync({
        targetProfileId: currentProposal.profileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });
    }
  }, [currentProposal.profileId, currentProposal.isFollowedByUser, addRelationshipMutation, removeRelationshipMutation]);

  if (!editor) {
    return (
      <ProposalViewLayout
        backHref={backHref}
        title={title || 'Untitled Proposal'}
        onLike={handleLike}
        onFollow={handleFollow}
        isLiked={currentProposal.isLikedByUser || false}
        isFollowing={currentProposal.isFollowedByUser || false}
        isLoading={isLoading}
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
      isLiked={currentProposal.isLikedByUser || false}
      isFollowing={currentProposal.isFollowedByUser || false}
      isLoading={isLoading}
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
            {currentProposal.submittedBy && (
              <>
                <Avatar
                  placeholder={
                    currentProposal.submittedBy.name ||
                    currentProposal.submittedBy.slug ||
                    'U'
                  }
                  className="h-8 w-8"
                >
                  {currentProposal.submittedBy.avatarImage?.name ? (
                    <Image
                      src={
                        getPublicUrl(currentProposal.submittedBy.avatarImage.name) ??
                        ''
                      }
                      alt={
                        currentProposal.submittedBy.name ||
                        currentProposal.submittedBy.slug ||
                        ''
                      }
                      fill
                      className="aspect-square object-cover"
                    />
                  ) : null}
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-neutral-charcoal">
                    {currentProposal.submittedBy.name || currentProposal.submittedBy.slug}
                  </span>
                  <span className="text-xs text-neutral-gray2">
                    Submitted on {formatDate(currentProposal.createdAt)}
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
            <div>
              <EditorContent
                className="[&>div]:px-0 [&>div]:py-0"
                editor={editor}
              />
            </div>
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
                    profileId={currentProposal.profileId || undefined}
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
