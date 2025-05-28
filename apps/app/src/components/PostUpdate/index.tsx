'use client';

import { useFileUpload } from '@/hooks/useFileUpload';
import { useUser } from '@/utils/UserProvider';
import { detectLinks } from '@/utils/linkDetection';
import { trpc } from '@op/api/client';
import type { Organization, PostToOrganization } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { TextArea } from '@op/ui/Field';
import { FileUploader } from '@op/ui/FileUploader';
import { Form } from '@op/ui/Form';
import { cn } from '@op/ui/utils';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { LuImage } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { LinkPreview } from '@/components/LinkPreview';
import { FeedItem, FeedMain } from '@/components/PostFeed';

import { OrganizationAvatar } from '../OrganizationAvatar';

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
        // @ts-expect-error - temporary
        (old) =>
          old
            ? [
                {
                  ...{ organization: organization, post: newPost },
                  createdAt: new Date(),
                },
                ...old,
              ]
            : [{ ...newPost, createdAt: new Date() }],
      );

      return { previousPosts };
    },
    onError: (
      _,
      __,
      context: { previousPosts?: Array<PostToOrganization> } | undefined,
    ) => {
      // Roll back to the previous posts on error
      utils.organization.listPosts.setData(
        { slug: organization.slug },
        context?.previousPosts || [],
      );
    },
    onSettled: () => {
      // Invalidate the posts query to sync with the server
      // void utils.organization.listPosts.invalidate({ slug: organization.slug });
      utils.organization.invalidate();
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.addEventListener('input', () => {
        if (textareaRef.current) {
          textareaRef.current.style.height = '2.5rem'; // Reset to min height
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
          <Form onSubmit={handleSubmit} className="flex w-full flex-row gap-4">
            <TextArea
              className="size-full h-10 min-h-10 overflow-y-hidden"
              variant="borderless"
              ref={textareaRef as RefObject<HTMLTextAreaElement>}
              placeholder={`Post an update…`}
              value={content}
              onChange={(e) => handleContentChange(e.target.value ?? '')}
            />
            {(content.length > 0 || fileUpload.hasUploadedFiles()) && (
              <Button color="secondary" type="submit">
                {t('Post')}
              </Button>
            )}
          </Form>
          {detectedUrls.length > 0 && (
            <div>
              {detectedUrls.map((url, index) => (
                <LinkPreview key={index} url={url} />
              ))}
            </div>
          )}

          <div className="flex w-full gap-6">
            <FileUploader
              onUpload={fileUpload.uploadFile}
              onRemove={fileUpload.removeFile}
              acceptedTypes={[
                'image/png',
                'image/jpeg',
                'image/webp',
                'application/pdf',
              ]}
              maxFiles={1}
              enableDragAndDrop={true}
              className="flex-1"
            >
              <LuImage className="size-4" />
              {t('Media')}
            </FileUploader>
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
