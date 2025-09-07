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
import { Header1 } from '@op/ui/Header';
import { Surface } from '@op/ui/Surface';
import { Tag, TagGroup } from '@op/ui/TagGroup';
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
import { Heart, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useMemo, useRef } from 'react';
import { LuBookmark } from 'react-icons/lu';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { PostFeed, PostItem, usePostFeedActions } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';
import { IframelyExtension } from './IframelyExtension';
import { ProposalViewLayout } from './ProposalViewLayout';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalViewProps {
  proposal: Proposal;
  backHref: string;
}

export function ProposalView({
  proposal: initialProposal,
  backHref,
}: ProposalViewProps) {
  const t = useTranslations();
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: proposal } = trpc.decision.getProposal.useQuery({
    proposalId: initialProposal.id,
  });

  // Safety check - fallback to initial data if query returns undefined
  const currentProposal = proposal || initialProposal;

  // Get current user to check edit permissions
  const { user } = useUser();

  // Proposal viewed tracking is now handled in the backend (getProposal endpoint)

  // Direct tRPC mutations for like/follow functionality with optimistic updates
  const addRelationshipMutation = trpc.profile.addRelationship.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await utils.decision.getProposal.cancel({
        proposalId: currentProposal.id,
      });

      // Snapshot the previous value
      const previousData = utils.decision.getProposal.getData({
        proposalId: currentProposal.id,
      });

      // Optimistically update the cache
      if (previousData) {
        const optimisticData = { ...previousData };
        if (variables.relationshipType === ProfileRelationshipType.LIKES) {
          optimisticData.isLikedByUser = true;
        } else if (
          variables.relationshipType === ProfileRelationshipType.FOLLOWING
        ) {
          optimisticData.isFollowedByUser = true;
        }
        utils.decision.getProposal.setData(
          { proposalId: currentProposal.id },
          optimisticData,
        );
      }

      return { previousData };
    },
    onSuccess: () => {
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        utils.decision.getProposal.setData(
          { proposalId: currentProposal.id },
          context.previousData,
        );
      }
      console.error('Failed to add relationship:', error);
    },
    onSettled: () => {
      // Always refetch after error or success
      utils.decision.getProposal.invalidate({ proposalId: currentProposal.id });
      utils.decision.listProposals.invalidate(); // Also invalidate list to keep ProposalCard in sync
    },
  });

  const removeRelationshipMutation =
    trpc.profile.removeRelationship.useMutation({
      onMutate: async (variables) => {
        // Cancel outgoing refetches
        await utils.decision.getProposal.cancel({
          proposalId: currentProposal.id,
        });

        // Snapshot the previous value
        const previousData = utils.decision.getProposal.getData({
          proposalId: currentProposal.id,
        });

        // Optimistically update the cache
        if (previousData) {
          const optimisticData = { ...previousData };
          if (variables.relationshipType === ProfileRelationshipType.LIKES) {
            optimisticData.isLikedByUser = false;
          } else if (
            variables.relationshipType === ProfileRelationshipType.FOLLOWING
          ) {
            optimisticData.isFollowedByUser = false;
          }
          utils.decision.getProposal.setData(
            { proposalId: currentProposal.id },
            optimisticData,
          );
        }

        return { previousData };
      },
      onError: (error, _variables, context) => {
        // Rollback on error
        if (context?.previousData) {
          utils.decision.getProposal.setData(
            { proposalId: currentProposal.id },
            context.previousData,
          );
        }
        console.error('Failed to remove relationship:', error);
      },
      onSettled: () => {
        // Always refetch after error or success
        utils.decision.getProposal.invalidate({
          proposalId: currentProposal.id,
        });
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
  const { title, budget, category, description } = parseProposalData(
    currentProposal.proposalData,
  );
  
  const proposalContent = description;

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
      content: proposalContent || '<p>No content available</p>',
      editable: false, // Make editor read-only
      editorProps: {
        attributes: {
          class:
            'prose prose-lg max-w-none focus:outline-none px-6 py-6 text-neutral-black',
        },
      },
      immediatelyRender: false,
    }),
    [proposalContent],
  );

  // Create read-only editor for content display
  const editor = useEditor(editorConfig);

  const isLoading =
    addRelationshipMutation.isPending || removeRelationshipMutation.isPending;

  const handleLike = useCallback(async () => {
    console.log('handleLike called', {
      profileId: currentProposal.profileId,
      isLikedByUser: currentProposal.isLikedByUser,
    });

    if (!currentProposal.profileId) {
      console.error('No profileId provided for like action');
      return;
    }

    try {
      if (currentProposal.isLikedByUser) {
        // Unlike
        await removeRelationshipMutation.mutateAsync({
          targetProfileId: currentProposal.profileId,
          relationshipType: ProfileRelationshipType.LIKES,
        });
      } else {
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
  }, [
    currentProposal.profileId,
    currentProposal.isLikedByUser,
    addRelationshipMutation,
    removeRelationshipMutation,
  ]);

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
  }, [
    currentProposal.profileId,
    currentProposal.isFollowedByUser,
    addRelationshipMutation,
    removeRelationshipMutation,
  ]);

  if (!editor) {
    return (
      <ProposalViewLayout
        backHref={backHref}
        title={title || t('Untitled Proposal')}
        onLike={handleLike}
        onFollow={handleFollow}
        isLiked={currentProposal.isLikedByUser || false}
        isFollowing={currentProposal.isFollowedByUser || false}
        isLoading={isLoading}
        editHref={editHref}
        canEdit={canEdit}
      >
        <div className="flex flex-1 items-center justify-center">
          <div className="text-gray-500">{t('Loading proposal...')}</div>
        </div>
      </ProposalViewLayout>
    );
  }

  return (
    <ProposalViewLayout
      backHref={backHref}
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
        <div className="mx-auto flex max-w-xl flex-col gap-8">
          <div className="space-y-4">
            {/* Title */}
            <Header1 className="font-serif text-title-lg">
              {title || t('Untitled Proposal')}
            </Header1>
            <div className="space-y-6">
              {/* Metadata Row */}
              <div className="flex items-center gap-4">
                {category && (
                  <TagGroup>
                    <Tag className="sm:rounded-sm">{category}</Tag>
                  </TagGroup>
                )}
                {budget && (
                  <span className="font-serif text-title-base text-neutral-black">
                    {formatCurrency(budget)}
                  </span>
                )}
              </div>

              {/* Author and submission info */}
              <div className="flex items-center gap-2">
                {currentProposal.submittedBy && (
                  <>
                    <Avatar
                      placeholder={
                        currentProposal.submittedBy.name ||
                        currentProposal.submittedBy.slug ||
                        'U'
                      }
                      className="size-8"
                    >
                      {currentProposal.submittedBy.avatarImage?.name ? (
                        <Image
                          src={
                            getPublicUrl(
                              currentProposal.submittedBy.avatarImage.name,
                            ) ?? ''
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
                      <span className="text-base text-neutral-black">
                        {currentProposal.submittedBy.name ||
                          currentProposal.submittedBy.slug}
                      </span>
                      <span className="text-sm text-neutral-charcoal">
                        {t('Submitted on')}{' '}
                        {formatDate(currentProposal.createdAt)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Engagement Stats */}
              <div className="flex items-center gap-4 border-b border-t border-neutral-gray1 py-4 text-sm text-neutral-gray4">
                <div className="flex items-center gap-1">
                  <Heart className="h-4 w-4" />
                  <span>0 {t('Likes')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  <span>
                    {comments.length}{' '}
                    {comments.length !== 1 ? t('Comments') : t('Comment')}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <LuBookmark className="size-4" />
                  <span>1 {t('Follower')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Proposal Content */}
          <EditorContent
            className="[&>div]:px-0 [&>div]:py-0"
            editor={editor}
          />

          {/* Comments Section */}
          <div className="mt-12" ref={commentsContainerRef}>
            <div className="border-t border-neutral-gray1 pt-8">
              <h3 className="mb-6 text-lg font-semibold text-neutral-charcoal">
                {t('Comments')} ({comments.length})
              </h3>

              {/* Comment Input */}
              <div className="mb-8">
                <Surface className="border-0 p-0 sm:border sm:p-4">
                  <PostUpdate
                    profileId={currentProposal.profileId || undefined}
                    placeholder={`${t('Comment')}${user?.currentProfile?.name ? ` as ${user?.currentProfile?.name}` : ''}...`}
                    label={t('Comment')}
                    onSuccess={scrollToComments}
                    proposalId={currentProposal.id}
                    processInstanceId={currentProposal.processInstance?.id}
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
                  {t('Loading comments...')}
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
                  {t('No comments yet. Be the first to comment!')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProposalViewLayout>
  );
}
