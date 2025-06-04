'use client';

import { useFileUpload } from '@/hooks/useFileUpload';
import { useUser } from '@/utils/UserProvider';
import { detectLinks } from '@/utils/linkDetection';
import { trpc } from '@op/api/client';
import type { RouterOutput } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { TextArea } from '@op/ui/Field';
import { Form } from '@op/ui/Form';
import { Skeleton } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { LuImage, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { LinkPreview } from '@/components/LinkPreview';
import { FeedItem, FeedMain } from '@/components/PostFeed';

import { OrganizationAvatar } from '../OrganizationAvatar';

type PaginatedPostToOrganizations = RouterOutput['organization']['listPosts'];

const PostUpdateWithUser = ({
  organization,
  className,
}: {
  organization: Organization;
  className?: string;
}) => {
  const [content, setContent] = useState('');
  const [detectedUrls, setDetectedUrls] = useState<string[]>([]);
  const t = useTranslations();
  const utils = trpc.useUtils();
  const router = useRouter();

  const fileUpload = useFileUpload({
    organizationId: organization.id,
    acceptedTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
    maxFiles: 1,
  });

  const createPost = trpc.organization.createPost.useMutation({
    onMutate: (newPost) => {
      // Cancel any outgoing refetches for the posts query
      // await utils.organization.listPosts.cancel();
      // Snapshot the previous list of posts
      const previousPosts = utils.organization.listPosts.getData({
        slug: organization.slug,
      });

      // Optimistically update the cache with the new post
      utils.organization.listPosts.setData(
        { slug: organization.slug },
        (old) => ({
          ...(old ? old : { hasMore: false }),
          items: [
            {
              postId: newPost.id,
              organizationId: organization.id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              deletedAt: null,
              post: {
                id: crypto.randomUUID(),
                content: newPost.content,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                attachments: [],
              },
              organization,
            },
            ...(old ? old.items : []),
          ],
        }),
      );

      return { previousPosts };
    },
    onError: (
      _,
      __,
      context: { previousPosts?: PaginatedPostToOrganizations } | undefined,
    ) => {
      // Roll back to the previous posts on error
      utils.organization.listPosts.setData(
        { slug: organization.slug },
        context?.previousPosts || { items: [], hasMore: false },
      );
    },
    onSettled: () => {
      void utils.organization.listPosts.invalidate({ slug: organization.slug });
      utils.organization.invalidate();
      // Refresh server-side components
      router.refresh();
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    createNewPostUpdate();
  };

  const createNewPostUpdate = () => {
    if (content.trim() || fileUpload.hasUploadedFiles()) {
      createPost.mutate({
        id: organization.id,
        content: content.trim() || '',
        attachmentIds: fileUpload.getUploadedAttachmentIds(),
      });
      setContent('');
      setDetectedUrls([]);
      fileUpload.clearFiles();
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
    if (textareaRef.current) {
      textareaRef.current.addEventListener('input', () => {
        if (textareaRef.current) {
          textareaRef.current.style.height = '1.5rem'; // Reset to min height
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; // Set to scrollHeight
        }
      });
    }
  }, [textareaRef]);

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <FeedItem>
        <OrganizationAvatar
          organization={organization}
          className="size-8 rounded-full border bg-white"
        />
        <FeedMain className="relative">
          <Form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
            <TextArea
              className="size-full h-6 overflow-y-hidden"
              variant="borderless"
              ref={textareaRef as RefObject<HTMLTextAreaElement>}
              placeholder={`Post an update…`}
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
                        className="absolute right-2 top-2"
                        size="small"
                        color="neutral"
                      >
                        <LuX className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative flex aspect-video w-full items-center justify-center rounded bg-neutral-gray1 text-white">
                      <div className="font-serif text-lg">
                        {filePreview.file.name}
                      </div>
                      <Button
                        onPress={() => fileUpload.removeFile(filePreview.id)}
                        className="absolute right-2 top-2"
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
            <div>
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
              className="flex items-center gap-2 text-sm text-charcoal transition-colors hover:text-black"
              disabled={fileUpload.filePreviews.length >= 1}
            >
              <LuImage className="size-4" />
              {t('Media')}
            </button>
            <Button
              size="small"
              isDisabled={
                !(content.length > 0 || fileUpload.hasUploadedFiles())
              }
              onPress={createNewPostUpdate}
            >
              {t('Post')}
            </Button>
          </div>
        </FeedMain>
      </FeedItem>
    </div>
  );
};

export const PostUpdate = ({
  organization,
  className,
}: {
  organization?: Organization;
  className?: string;
}) => {
  const { user } = useUser();
  const profile = user?.currentOrganization;

  if (
    !(profile && !organization) &&
    (!profile || organization?.id !== profile.id)
  ) {
    return <div className={cn(className, 'border-none p-0')} />;
  }

  return (
    <PostUpdateWithUser
      organization={organization ?? profile}
      className={className}
    />
  );
};
