'use client';

import { useFileUpload } from '@/hooks/useFileUpload';
import { useUser } from '@/utils/UserProvider';
import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { detectLinks } from '@/utils/linkDetection';
import { createCommentsQueryKey } from '@/utils/queryKeys';
import { trpc } from '@op/api/client';
import type { Organization, Post } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { TextArea } from '@op/ui/Field';
import { Form } from '@op/ui/Form';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { MediaDisplay } from '@op/ui/MediaDisplay';
import { Skeleton } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { LuImage, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { FeedItem, FeedMain } from '@/components/Feed';
import { LinkPreview } from '@/components/LinkPreview';

import { OrganizationAvatar } from '../OrganizationAvatar';

const TextCounter = ({ text, max }: { text: string; max: number }) => {
  if (!text || text.length === 0) {
    return null;
  }
  const textLength = text.length;
  const countDown = max - textLength;

  return (
    <span
      className={cn(
        'text-neutral-charcoal',
        countDown < 0 && 'text-functional-red',
      )}
    >
      {countDown}
    </span>
  );
};

const PostUpdateWithUser = ({
  organization,
  className,
  parentPostId,
  profileId,
  placeholder,
  onSuccess,
  label,
  proposalId,
  processInstanceId,
  characterLimit = 240,
}: {
  organization?: Organization | null;
  className?: string;
  parentPostId?: string; // If provided, this becomes a comment
  profileId?: string; // Profile ID to associate the post with (can be any profile type)
  placeholder?: string;
  onSuccess?: () => void;
  label: string;
  proposalId?: string; // If provided, this is a proposal comment
  processInstanceId?: string; // Process instance ID for proposal comments
  characterLimit?: number;
}) => {
  const { user } = useUser();
  const [content, setContent] = useState('');
  const [detectedUrls, setDetectedUrls] = useState<string[]>([]);
  const [lastFailedPost, setLastFailedPost] = useState<{
    content: string;
    attachmentIds: string[];
  } | null>(null);
  const [optimisticCommentId, setOptimisticCommentId] = useState<string | null>(
    null,
  );
  const optimisticCommentRef = useRef<string | null>(null);
  const t = useTranslations();
  const utils = trpc.useUtils();
  const router = useRouter();
  const isOnline = useConnectionStatus();

  const fileUpload = useFileUpload({
    acceptedTypes: [
      'image/gif',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
    ],
    maxFiles: 1,
  });

  // For organization posts (main feed posts)
  const createOrganizationPost = trpc.organization.createPost.useMutation({
    onSuccess: () => {
      // Clear form on success
      setContent('');
      setDetectedUrls([]);
      fileUpload.clearFiles();
      setLastFailedPost(null);

      // Invalidate organization feeds to show new post
      if (organization?.profile?.slug) {
        void utils.organization.listPosts.invalidate();
        void utils.organization.listAllPosts.invalidate();
      }

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (err) => {
      const errorInfo = analyzeError(err);

      if (errorInfo.isConnectionError) {
        // Store failed post data for retry
        setLastFailedPost({
          content: content.trim(),
          attachmentIds: fileUpload.getUploadedAttachmentIds(),
        });

        toast.error({
          message: errorInfo.message + ' Use the retry button to try again.',
        });
      } else {
        toast.error({ message: errorInfo.message });
      }

      console.log('ERROR', err);
    },
  });

  // For profile posts (comments, etc.)
  const createPost = trpc.posts.createPost.useMutation({
    onMutate: async (variables) => {
      const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      optimisticCommentRef.current = tempId;
      setOptimisticCommentId(tempId);

      // For comments (posts with parentPostId)
      if (variables.parentPostId) {
        // Cancel any outgoing refetches
        const queryKey = createCommentsQueryKey(
          variables.parentPostId,
          profileId,
        );
        await utils.posts.getPosts.cancel(queryKey);

        // Snapshot previous value
        const previousComments = utils.posts.getPosts.getData(queryKey);

        // Add optimistic comment immediately
        const optimisticComment: Post = {
          id: tempId,
          content: variables.content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          profile: user.currentProfile || null,
          profileId: user.currentProfileId || null,
          parentPostId: variables.parentPostId,
          attachments: [],
          reactionCounts: {},
          reactionUsers: {},
          userReaction: null,
          commentCount: 0,
          childPosts: null,
          parentPost: null,
        };

        // Add optimistic comment
        utils.posts.getPosts.setData(queryKey, (old) => {
          if (!old) return [optimisticComment];
          return [optimisticComment, ...old];
        });

        return { previousComments, tempId, isComment: true };
      }

      // For top-level posts (profile posts like proposal comments)
      if (profileId) {
        // Cancel any outgoing refetches for profile posts
        const queryKey = {
          profileId,
          parentPostId: null,
          limit: 50,
          offset: 0,
          includeChildren: false,
        };
        await utils.posts.getPosts.cancel(queryKey);

        // Snapshot previous value
        const previousPosts = utils.posts.getPosts.getData(queryKey);

        // Add optimistic post immediately
        const optimisticPost: Post = {
          id: tempId,
          content: variables.content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          profile: user.currentProfile || null,
          profileId: user.currentProfileId || null,
          parentPostId: null,
          attachments: [],
          reactionCounts: {},
          reactionUsers: {},
          userReaction: null,
          commentCount: 0,
          childPosts: null,
          parentPost: null,
        };

        // Add optimistic post
        utils.posts.getPosts.setData(queryKey, (old) => {
          if (!old) return [optimisticPost];
          return [optimisticPost, ...old];
        });

        return { previousPosts, tempId, isComment: false };
      }

      return {};
    },
    onError: (err, variables, context) => {
      const errorInfo = analyzeError(err);

      // Rollback optimistic updates on error
      if (context?.tempId && optimisticCommentRef.current === context.tempId) {
        // For comments (posts with parentPostId)
        if (variables.parentPostId && context.isComment) {
          // Restore previous comments state
          const queryKey = createCommentsQueryKey(
            variables.parentPostId,
            profileId,
          );
          utils.posts.getPosts.setData(queryKey, context.previousComments);

          // Revert parent post comment count - only for organization posts
          if (organization?.profile?.slug) {
            void utils.organization.listPosts.invalidate();
            void utils.organization.listAllPosts.invalidate();
          }
        }

        // For top-level posts (profile posts)
        if (profileId && !context.isComment) {
          // Restore previous posts state
          const queryKey = {
            profileId,
            parentPostId: null,
            limit: 50,
            offset: 0,
            includeChildren: false,
          };
          utils.posts.getPosts.setData(queryKey, context.previousPosts);
        }

        // Clear the optimistic comment ID
        optimisticCommentRef.current = null;
        setOptimisticCommentId(null);
      }

      if (errorInfo.isConnectionError) {
        // Store failed post data for retry
        setLastFailedPost({
          content: content.trim(),
          attachmentIds: fileUpload.getUploadedAttachmentIds(),
        });

        toast.error({
          message: errorInfo.message + ' Use the retry button to try again.',
        });
      } else {
        toast.error({ message: errorInfo.message });
      }

      console.log('ERROR', err);
    },
    onSuccess: (data, variables) => {
      // Clear form and failed post on success
      setContent('');
      setDetectedUrls([]);
      fileUpload.clearFiles();
      setLastFailedPost(null);

      if (data && optimisticCommentRef.current) {
        // Clear the optimistic comment ID since we have real data
        optimisticCommentRef.current = null;
        setOptimisticCommentId(null);

        // Enhance server data with user profile if not present
        const enhancedData = {
          ...data,
          profile: data.profile || user.currentProfile || null,
        };

        // For comments (posts with parentPostId)
        if (variables.parentPostId) {
          const queryKey = createCommentsQueryKey(
            variables.parentPostId,
            profileId,
          );
          utils.posts.getPosts.setData(queryKey, (old) => {
            if (!old) return [enhancedData];
            // Replace optimistic comment with real data, or add if not found
            if (optimisticCommentId) {
              const index = old.findIndex(
                (comment) => comment.id === optimisticCommentId,
              );
              if (index >= 0) {
                const newComments = [...old];
                newComments[index] = enhancedData;
                return newComments;
              }
            }
            // Add the new comment to the beginning if no optimistic comment to replace
            return [enhancedData, ...old];
          });

          // Update parent post's comment count in main feed caches
          const updateCommentCount = (item: any) => {
            if (item.post.id === variables.parentPostId) {
              return {
                ...item,
                post: {
                  ...item.post,
                  commentCount: (item.post.commentCount || 0) + 1,
                },
              };
            }
            return item;
          };

          // Update organization.listPosts cache only if organization exists
          if (organization?.profile?.slug) {
            utils.organization.listPosts.setInfiniteData(
              { slug: organization.profile.slug },
              (old) => {
                if (!old) return old;
                return {
                  ...old,
                  pages: old.pages.map((page) => ({
                    ...page,
                    items: page.items.map(updateCommentCount),
                  })),
                };
              },
            );

            // Update organization.listAllPosts cache
            utils.organization.listAllPosts.setData({}, (old) => {
              if (!old) return old;
              return {
                ...old,
                items: old.items.map(updateCommentCount),
              };
            });
          }
        }

        // For top-level posts (profile posts like proposal comments)
        if (profileId && !variables.parentPostId) {
          const queryKey = {
            profileId,
            parentPostId: null,
            limit: 50,
            offset: 0,
            includeChildren: false,
          };
          utils.posts.getPosts.setData(queryKey, (old) => {
            if (!old) return [enhancedData];
            // Replace optimistic post with real data, or add if not found
            if (optimisticCommentId) {
              const index = old.findIndex(
                (post) => post.id === optimisticCommentId,
              );
              if (index >= 0) {
                const newPosts = [...old];
                newPosts[index] = enhancedData;
                return newPosts;
              }
            }
            // Add the new post to the beginning if no optimistic post to replace
            return [enhancedData, ...old];
          });

          // If this is a proposal comment, invalidate proposal queries to refresh comment counts
          if (proposalId) {
            void utils.decision.getProposal.invalidate({ profileId });
            void utils.decision.listProposals.invalidate();
          }
        }
      }

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onSettled: (_data, error, variables) => {
      // For comments (posts with parentPostId)
      if (variables.parentPostId) {
        // Minimal invalidation since optimistic updates handle UI
        // Only invalidate on ERROR to trigger recovery
        if (error) {
          const queryKey = createCommentsQueryKey(
            variables.parentPostId,
            profileId,
          );
          void utils.posts.getPosts.invalidate(queryKey);
          // Also invalidate main feeds on error to refresh comment counts - only for organization posts
          if (organization?.profile?.slug) {
            void utils.organization.listPosts.invalidate();
            void utils.organization.listAllPosts.invalidate();
          }
        }
        // Don't refresh router for comments to avoid layout shifts
      } else {
        // For top-level posts
        if (profileId) {
          // For profile posts (like proposal comments), only invalidate on error
          if (error) {
            const queryKey = {
              profileId,
              parentPostId: null,
              limit: 50,
              offset: 0,
              includeChildren: false,
            };
            void utils.posts.getPosts.invalidate(queryKey);

            // If this was a proposal comment, also invalidate proposal queries on error
            if (variables.proposalId) {
              void utils.decision.getProposal.invalidate({ profileId });
              void utils.decision.listProposals.invalidate();
            }
          }
          // Don't refresh router for profile posts to avoid layout shifts
        } else if (organization?.profile?.slug) {
          // For organization posts, invalidate organization caches
          void utils.organization.listPosts.invalidate();
          void utils.organization.listAllPosts.invalidate();
          router.refresh();
        }
      }
    },
  });

  const retryFailedPost = () => {
    if (lastFailedPost) {
      // For organization posts (main feed posts without parentPostId or profileId)
      if (organization && !parentPostId && !profileId) {
        const orgMutationData = {
          id: organization.id,
          content: lastFailedPost.content,
          attachmentIds: lastFailedPost.attachmentIds,
        };

        createOrganizationPost.mutate(orgMutationData);
        return;
      }

      // For profile posts (comments, etc.)
      const mutationData: any = {
        content: lastFailedPost.content,
        parentPostId,
        attachmentIds: lastFailedPost.attachmentIds,
      };

      // Add profile association if provided
      if (profileId) {
        mutationData.profileId = profileId;
      }

      // Add proposal context for analytics
      if (proposalId) {
        mutationData.proposalId = proposalId;
      }
      if (processInstanceId) {
        mutationData.processInstanceId = processInstanceId;
      }

      createPost.mutate(mutationData);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    createNewPostUpdate();
  };

  const createNewPostUpdate = () => {
    if (content.trim() || fileUpload.hasUploadedFiles()) {
      // Check if offline
      if (!isOnline) {
        toast.error({
          message: t(
            'You are offline. Please check your connection and try again.',
          ),
        });
        return;
      }

      // For organization posts (main feed posts without parentPostId or profileId)
      if (organization && !parentPostId && !profileId) {
        // Prevent duplicate submissions while mutation is pending
        if (createOrganizationPost.isPending) {
          return;
        }

        const orgMutationData = {
          id: organization.id,
          content: content.trim() || '',
          attachmentIds: fileUpload.getUploadedAttachmentIds(),
        };

        createOrganizationPost.mutate(orgMutationData);
        return;
      }

      // For profile posts (comments, etc.)
      // Prevent duplicate submissions while mutation is pending
      if (createPost.isPending) {
        return;
      }

      // Optimistic updates are now handled in onMutate
      const mutationData: any = {
        content: content.trim() || '',
        parentPostId,
        attachmentIds: fileUpload.getUploadedAttachmentIds(),
      };

      // Add profile association if provided
      if (profileId) {
        mutationData.profileId = profileId;
      }

      // Add proposal context for analytics
      if (proposalId) {
        mutationData.proposalId = proposalId;
      }
      if (processInstanceId) {
        mutationData.processInstanceId = processInstanceId;
      }

      createPost.mutate(mutationData);
    }
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    const { urls } = detectLinks(value);
    setDetectedUrls(urls);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();

      createNewPostUpdate();
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const handleInput = () => {
        textarea.style.height = '1.5rem'; // Reset to min height
        textarea.style.height = `${textarea.scrollHeight}px`; // Set to scrollHeight
      };

      textarea.addEventListener('input', handleInput);

      // Cleanup function to remove event listener
      return () => {
        textarea.removeEventListener('input', handleInput);
      };
    }
  }, []);

  if (!user.currentProfile) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-2 sm:flex', className)}>
      <FeedItem>
        {organization ? (
          <OrganizationAvatar
            profile={organization.profile}
            className="size-8 bg-white"
          />
        ) : user.currentProfile ? (
          <OrganizationAvatar
            profile={user.currentProfile}
            className="size-8 bg-white"
          />
        ) : (
          <div className="bg-neutral-gray1 size-8 rounded-full" />
        )}
        <FeedMain className="relative">
          <Form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
            <TextArea
              className="size-full h-6 overflow-y-hidden"
              variant="borderless"
              ref={textareaRef as RefObject<HTMLTextAreaElement>}
              placeholder={placeholder || t('Post an update…')}
              value={content}
              onChange={(e) => handleContentChange(e.target.value ?? '')}
              onKeyDown={handleKeyDown}
            />
          </Form>
          {fileUpload.filePreviews?.length > 0 && (
            <div className="w-full">
              {fileUpload.filePreviews.map((filePreview) => (
                <div key={filePreview.id} className="relative">
                  {filePreview.uploading ? (
                    <Skeleton className="relative flex aspect-video w-full items-center justify-center rounded text-white" />
                  ) : filePreview.file.type.startsWith('image/') ? (
                    <div className="bg-neutral-gray1 relative flex aspect-video w-full items-center justify-center rounded text-white">
                      {filePreview.error ? (
                        <p className="text-sm">{filePreview.error}</p>
                      ) : (
                        <img
                          src={filePreview.url}
                          alt={filePreview.file.name}
                          className="size-full rounded object-cover"
                        />
                      )}
                      <Button
                        onPress={() => fileUpload.removeFile(filePreview.id)}
                        className="absolute right-2 top-2 size-6 rounded-full p-0 opacity-80 hover:opacity-100 focus:outline-1"
                        size="small"
                        color="neutral"
                      >
                        <LuX className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative w-full">
                      <MediaDisplay
                        title={filePreview.file.name}
                        mimeType={filePreview.file.type}
                        url={filePreview.url}
                        size={filePreview.file.size}
                      />
                      <Button
                        onPress={() => fileUpload.removeFile(filePreview.id)}
                        className="absolute right-2 top-2 size-6 rounded-full p-0 opacity-80 hover:opacity-100 focus:outline-1"
                        size="small"
                        color="neutral"
                      >
                        <LuX className="size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {detectedUrls.length > 0 && (
            <div className="max-w-full">
              {detectedUrls.map((url, index) => (
                <LinkPreview key={index} url={url} />
              ))}
            </div>
          )}
          <div
            className={cn(
              'flex w-full items-center justify-between gap-2',
              (content || fileUpload.filePreviews?.length) &&
                'border-neutral-gray1 border-t py-2',
            )}
          >
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = [
                  'image/png',
                  'image/gif',
                  'image/jpeg',
                  'image/webp',
                  'application/pdf',
                ].join(',');
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    fileUpload.uploadFile(file);
                  }
                };
                input.click();
              }}
              className="text-neutral-charcoal flex items-center gap-2 text-base transition-colors hover:text-black"
              disabled={fileUpload.filePreviews.length >= 1}
            >
              <LuImage className="size-4" />
              {t('Media')}
            </button>
            <div className="text-neutral-charcoal flex items-center gap-2">
              <TextCounter text={content} max={characterLimit} />
              {lastFailedPost && (
                <Button
                  size="small"
                  color="secondary"
                  onPress={retryFailedPost}
                  isDisabled={
                    createPost.isPending || createOrganizationPost.isPending
                  }
                >
                  {createPost.isPending || createOrganizationPost.isPending
                    ? t('Retrying...')
                    : t('Retry Failed Post')}
                </Button>
              )}
              <Button
                size="small"
                isDisabled={
                  !(content.length > 0 || fileUpload.hasUploadedFiles()) ||
                  content.length > characterLimit ||
                  !isOnline
                }
                onPress={createNewPostUpdate}
              >
                {createPost.isPending || createOrganizationPost.isPending ? (
                  <LoadingSpinner />
                ) : (
                  label
                )}
              </Button>
            </div>
          </div>
        </FeedMain>
      </FeedItem>
    </div>
  );
};

export const PostUpdate = ({
  organization,
  className,
  parentPostId,
  profileId,
  placeholder,
  onSuccess,
  label,
  proposalId,
  processInstanceId,
}: {
  organization?: Organization;
  className?: string;
  parentPostId?: string;
  profileId?: string;
  placeholder?: string;
  onSuccess?: () => void;
  label: string;
  proposalId?: string;
  processInstanceId?: string;
}) => {
  const { user } = useUser();
  const currentProfileId = user.currentProfileId;

  // For profile-based associations (like proposals), we don't need an organization
  if (profileId) {
    return (
      <PostUpdateWithUser
        organization={undefined}
        className={className}
        parentPostId={parentPostId}
        profileId={profileId}
        placeholder={placeholder}
        onSuccess={onSuccess}
        label={label}
        proposalId={proposalId}
        processInstanceId={processInstanceId}
        characterLimit={1500}
      />
    );
  }

  if (
    !(currentProfileId && !organization) &&
    (!currentProfileId || organization?.profile?.id !== currentProfileId)
  ) {
    return <div className={cn(className, 'border-none p-0')} />;
  }

  // TODO: Ugly! Still a stopgap until we migrate off of organizationId
  if (
    organization &&
    (user.currentOrganization?.profile.id !== currentProfileId ||
      !user.currentOrganization)
  ) {
    return null;
  }

  const org = organization ?? user.currentOrganization;

  return (
    <PostUpdateWithUser
      organization={org}
      className={className}
      parentPostId={parentPostId}
      profileId={profileId}
      placeholder={placeholder}
      onSuccess={onSuccess}
      label={label}
    />
  );
};
