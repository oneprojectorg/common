'use client';

import { useFileUpload } from '@/hooks/useFileUpload';
import { useUser } from '@/utils/UserProvider';
import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { detectLinks } from '@/utils/linkDetection';
import { createCommentsQueryKey } from '@/utils/queryKeys';
import { userCanInteract } from '@/utils/userCanInteract';
import { trpc } from '@op/api/client';
import type { Organization, Post } from '@op/api/encoders';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@op/sense/InputGroup';
import { MediaDisplay } from '@op/sense/MediaDisplay';
import { Skeleton } from '@op/sense/Skeleton';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { LuImage, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

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
      className={cn('text-foreground', countDown < 0 && 'text-destructive')}
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
  label: ReactNode;
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

        toast.error(errorInfo.message + ' Use the retry button to try again.');
      } else {
        toast.error(errorInfo.message);
      }

      logger.error('Failed to create organization post', {
        error: err,
        context: 'PostUpdate.createOrgPost',
      });
    },
  });

  // For profile posts (comments, etc.)
  const createPost = trpc.posts.createPost.useMutation({
    onMutate: async (variables) => {
      const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      optimisticCommentRef.current = tempId;

      setContent('');
      setDetectedUrls([]);
      setLastFailedPost(null);

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
          profile: user?.currentProfile || null,
          profileId: user?.currentProfileId || null,
          parentPostId: variables.parentPostId,
          rootProfileId: null,
          rootPostId: null,
          attachments: [],
          likeCount: 0,
          userHasLiked: false,
          likeUsers: [],
          commentCount: 0,
          childPosts: null,
          parentPost: null,
        };

        // Add optimistic comment
        utils.posts.getPosts.setData(queryKey, (old) => {
          if (!old) return [optimisticComment];
          return [optimisticComment, ...old];
        });

        return {
          previousComments,
          tempId,
          isComment: true,
        };
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
          profile: user?.currentProfile || null,
          profileId: user?.currentProfileId || null,
          parentPostId: null,
          rootProfileId: null,
          rootPostId: null,
          attachments: [],
          likeCount: 0,
          userHasLiked: false,
          likeUsers: [],
          commentCount: 0,
          childPosts: null,
          parentPost: null,
        };

        // Add optimistic post
        utils.posts.getPosts.setData(queryKey, (old) => {
          if (!old) return [optimisticPost];
          return [optimisticPost, ...old];
        });

        return {
          previousPosts,
          tempId,
          isComment: false,
        };
      }

      return {};
    },
    onError: (err, variables, context) => {
      const errorInfo = analyzeError(err);

      setContent(variables.content);
      setDetectedUrls(detectLinks(variables.content).urls);

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
      }

      if (errorInfo.isConnectionError) {
        // Store failed post data for retry
        setLastFailedPost({
          content: variables.content,
          attachmentIds: fileUpload.getUploadedAttachmentIds(),
        });

        toast.error(errorInfo.message + ' Use the retry button to try again.');
      } else {
        toast.error(errorInfo.message);
      }

      logger.error('Failed to create post', {
        error: err,
        context: 'PostUpdate.createPost',
      });
    },
    onSuccess: (data, variables, context) => {
      fileUpload.clearFiles();

      if (data && context?.tempId) {
        // Clear the optimistic comment ID since we have real data
        optimisticCommentRef.current = null;

        // Enhance server data with user profile if not present
        const enhancedData = {
          ...data,
          profile: data.profile || user?.currentProfile || null,
        };

        // For comments (posts with parentPostId)
        if (variables.parentPostId) {
          const queryKey = createCommentsQueryKey(
            variables.parentPostId,
            profileId,
          );
          utils.posts.getPosts.setData(queryKey, (old) => {
            if (!old) return [enhancedData];
            // Drop our optimistic placeholder; if a realtime refetch already
            // inserted the real comment, return without re-prepending.
            const filtered = old.filter((c) => c.id !== context.tempId);
            if (filtered.some((c) => c.id === enhancedData.id)) {
              return filtered;
            }
            return [enhancedData, ...filtered];
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
            // Drop our optimistic placeholder; if a realtime refetch already
            // inserted the real post, return without re-prepending.
            const filtered = old.filter((p) => p.id !== context.tempId);
            if (filtered.some((p) => p.id === enhancedData.id)) {
              return filtered;
            }
            return [enhancedData, ...filtered];
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
        toast.error(
          t('You are offline. Please check your connection and try again.'),
        );
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
        textarea.style.height = '1.5rem';
        textarea.style.height = `${textarea.scrollHeight}px`;
      };

      textarea.addEventListener('input', handleInput);

      return () => {
        textarea.removeEventListener('input', handleInput);
      };
    }
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && !content) {
      textarea.style.height = '1.5rem';
    }
  }, [content]);

  if (!userCanInteract(user)) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <InputGroup
        className={cn(
          'h-auto flex-row items-start gap-2 border-border p-3',
          className,
        )}
      >
        <InputGroupAddon
          align="inline-start"
          className="cursor-default items-start p-0"
        >
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
            <div className="size-8 rounded-full bg-secondary" />
          )}
        </InputGroupAddon>
        <div className="flex min-w-0 flex-1 flex-col">
          <InputGroupTextarea
            ref={textareaRef as RefObject<HTMLTextAreaElement>}
            className="min-h-0 overflow-y-hidden ps-1 pt-1"
            placeholder={placeholder || t('Post an update…')}
            value={content}
            onChange={(e) => handleContentChange(e.target.value ?? '')}
            onKeyDown={handleKeyDown}
          />
          {fileUpload.filePreviews?.length > 0 && (
            <div className="w-full px-3">
              {fileUpload.filePreviews.map((filePreview) => (
                <div key={filePreview.id} className="relative">
                  {filePreview.uploading ? (
                    <Skeleton className="relative flex aspect-video w-full items-center justify-center rounded text-white" />
                  ) : filePreview.file.type.startsWith('image/') ? (
                    <div className="relative flex aspect-video w-full items-center justify-center rounded bg-secondary text-white">
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
                        onClick={() => fileUpload.removeFile(filePreview.id)}
                        className="absolute end-2 top-2 size-6 rounded-full p-0 opacity-80 hover:opacity-100 focus-visible:outline-1"
                        size="sm"
                        variant="outline"
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
                        onClick={() => fileUpload.removeFile(filePreview.id)}
                        className="absolute end-2 top-2 size-6 rounded-full p-0 opacity-80 hover:opacity-100 focus-visible:outline-1"
                        size="sm"
                        variant="outline"
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
            <div className="w-full px-3">
              {detectedUrls.map((url, index) => (
                <LinkPreview key={index} url={url} />
              ))}
            </div>
          )}
          <InputGroupAddon
            align="block-end"
            className={cn(
              'justify-between border-t p-0',
              content ? 'border-border' : 'border-transparent',
            )}
          >
            <InputGroupButton
              size="md"
              className="-ms-3 text-primary"
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
              disabled={fileUpload.filePreviews.length >= 1}
            >
              <LuImage /> {t('Media')}
            </InputGroupButton>
            <div className="flex items-center gap-2">
              <TextCounter text={content} max={characterLimit} />
              {lastFailedPost && (
                <InputGroupButton
                  size="md"
                  variant="outline"
                  onClick={retryFailedPost}
                  disabled={
                    createPost.isPending || createOrganizationPost.isPending
                  }
                >
                  {createPost.isPending || createOrganizationPost.isPending
                    ? t('Retrying...')
                    : t('Retry Failed Post')}
                </InputGroupButton>
              )}
              <InputGroupButton
                type="submit"
                size="md"
                variant="default"
                disabled={
                  !(content.length > 0 || fileUpload.hasUploadedFiles()) ||
                  content.length > characterLimit ||
                  !isOnline
                }
                loading={
                  createPost.isPending || createOrganizationPost.isPending
                }
              >
                {label}
              </InputGroupButton>
            </div>
          </InputGroupAddon>
        </div>
      </InputGroup>
    </form>
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
  label: ReactNode;
  proposalId?: string;
  processInstanceId?: string;
}) => {
  const { user } = useUser();
  const currentProfileId = user?.currentProfileId;

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
    (user?.currentOrganization?.profile.id !== currentProfileId ||
      !user?.currentOrganization)
  ) {
    return null;
  }

  const org = organization ?? user?.currentOrganization;

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
