'use client';

import { useFileUpload } from '@/hooks/useFileUpload';
import { useUser } from '@/utils/UserProvider';
import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { detectLinks } from '@/utils/linkDetection';
import { createCommentsQueryKey } from '@/utils/queryKeys';
import { trpc } from '@op/api/client';
import type { Organization, Post } from '@op/api/encoders';
import { getCurrentProfileId } from '@op/common';
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
  placeholder,
  onSuccess,
  label,
}: {
  organization: Organization;
  className?: string;
  parentPostId?: string; // If provided, this becomes a comment
  placeholder?: string;
  onSuccess?: () => void;
  label: string;
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
    organizationId: organization.id,
    acceptedTypes: [
      'image/gif',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
    ],
    maxFiles: 1,
  });

  const createPost = trpc.posts.createPost.useMutation({
    onMutate: async (variables) => {
      // Generate optimistic ID for comments and add optimistic comment immediately
      if (variables.parentPostId) {
        const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        optimisticCommentRef.current = tempId;
        setOptimisticCommentId(tempId);

        // Cancel any outgoing refetches
        const queryKey = createCommentsQueryKey(variables.parentPostId);
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
          profile: user?.currentProfile || null,
          profileId: user?.currentProfileId || null,
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

        return { previousComments, tempId };
      }

      return {};
    },
    onError: (err, variables, context) => {
      const errorInfo = analyzeError(err);

      // Rollback optimistic comment updates on error
      if (
        variables.parentPostId &&
        context?.tempId &&
        optimisticCommentRef.current === context.tempId
      ) {
        // Restore previous comments state
        const queryKey = createCommentsQueryKey(variables.parentPostId);
        utils.posts.getPosts.setData(queryKey, context.previousComments);

        // Clear the optimistic comment ID
        optimisticCommentRef.current = null;
        setOptimisticCommentId(null);

        // Revert parent post comment count - invalidate to be safe
        void utils.organization.listPosts.invalidate();
        void utils.organization.listAllPosts.invalidate();
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

      // For comments, optimistically update the cache with enhanced server data
      if (variables.parentPostId && data && optimisticCommentRef.current) {
        // Clear the optimistic comment ID since we have real data
        optimisticCommentRef.current = null;
        setOptimisticCommentId(null);

        // Enhance server data with user profile if not present
        const enhancedData = {
          ...data,
          profile: data.profile || user?.currentProfile || null,
        };

        const queryKey = createCommentsQueryKey(variables.parentPostId);
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

        // Update organization.listPosts cache
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

      // Call onSuccess callback if provided (for comments)
      if (onSuccess) {
        onSuccess();
      }
    },
    onSettled: (_data, error, variables) => {
      if (!variables.parentPostId) {
        // For top-level posts, keep existing behavior
        void utils.organization.listPosts.invalidate();
        void utils.organization.listAllPosts.invalidate();
        router.refresh();
      } else {
        // For comments: minimal invalidation since optimistic updates handle UI
        // Only invalidate on ERROR to trigger recovery
        if (error) {
          const queryKey = createCommentsQueryKey(variables.parentPostId);
          void utils.posts.getPosts.invalidate(queryKey);
          // Also invalidate main feeds on error to refresh comment counts
          void utils.organization.listPosts.invalidate();
          void utils.organization.listAllPosts.invalidate();
        }
        // Don't refresh router for comments to avoid layout shifts
      }
    },
  });

  const retryFailedPost = () => {
    if (lastFailedPost) {
      createPost.mutate({
        content: lastFailedPost.content,
        organizationId: organization.id,
        parentPostId,
        attachmentIds: lastFailedPost.attachmentIds,
      });
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
          message:
            'You are offline. Please check your connection and try again.',
        });
        return;
      }

      // Prevent duplicate submissions while mutation is pending
      if (createPost.isPending) {
        return;
      }

      // Optimistic updates are now handled in onMutate

      createPost.mutate({
        content: content.trim() || '',
        organizationId: organization.id,
        parentPostId,
        attachmentIds: fileUpload.getUploadedAttachmentIds(),
      });
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

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <FeedItem>
        <OrganizationAvatar
          profile={organization.profile}
          className="size-8 bg-white"
        />
        <FeedMain className="relative">
          <Form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
            <TextArea
              className="size-full h-6 overflow-y-hidden"
              variant="borderless"
              ref={textareaRef as RefObject<HTMLTextAreaElement>}
              placeholder={placeholder || `Post an update…`}
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
                    <div className="relative flex aspect-video w-full items-center justify-center rounded bg-neutral-gray1 text-white">
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
              'flex w-full items-center justify-between gap-6',
              (content || fileUpload.filePreviews?.length) &&
                'border-t border-neutral-gray1 py-2',
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
              className="flex items-center gap-2 text-base text-neutral-charcoal transition-colors hover:text-black"
              disabled={fileUpload.filePreviews.length >= 1}
            >
              <LuImage className="size-4" />
              {t('Media')}
            </button>
            <div className="flex items-center gap-2 text-neutral-charcoal">
              <TextCounter text={content} max={240} />
              {lastFailedPost && (
                <Button
                  size="small"
                  color="secondary"
                  onPress={retryFailedPost}
                  isDisabled={createPost.isPending}
                >
                  {createPost.isPending ? 'Retrying...' : 'Retry Failed Post'}
                </Button>
              )}
              <Button
                size="small"
                isDisabled={
                  !(content.length > 0 || fileUpload.hasUploadedFiles()) ||
                  content.length > 240 ||
                  !isOnline
                }
                onPress={createNewPostUpdate}
              >
                {createPost.isPending ? <LoadingSpinner /> : label}
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
  placeholder,
  onSuccess,
  label,
}: {
  organization?: Organization;
  className?: string;
  parentPostId?: string;
  placeholder?: string;
  onSuccess?: () => void;
  label: string;
}) => {
  const { user } = useUser();
  const currentProfileId = user?.currentProfileId;

  if (
    !(currentProfileId && !organization) &&
    (!currentProfileId || organization?.profile?.id !== currentProfileId)
  ) {
    return <div className={cn(className, 'border-none p-0')} />;
  }

  console.log(
    'HELLO',
    user,
    currentProfileId,
    organization,
    user.currentOrganization,
  );
  // TODO: Ugly! Still a stopgap until we migrate off of organizationId
  if (
    organization &&
    (user.currentOrganization?.profile.id !== currentProfileId ||
      !user.currentOrganization)
  ) {
    return null;
  }

  return (
    <PostUpdateWithUser
      organization={organization ?? user.currentOrganization}
      className={className}
      parentPostId={parentPostId}
      placeholder={placeholder}
      onSuccess={onSuccess}
      label={label}
    />
  );
};
