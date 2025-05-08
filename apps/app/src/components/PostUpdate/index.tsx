import { getPublicUrl } from '@/utils';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/trpc/client';
import type { PostToOrganization } from '@op/trpc/encoders';
import { Button } from '@op/ui/Button';
import { TextArea } from '@op/ui/Field';
import { Form } from '@op/ui/Form';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { LuImage, LuPaperclip } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { FeedAvatar, FeedItem, FeedMain } from '@/components/PostFeed';

export const PostUpdate = ({ className }: { className?: string }) => {
  const { user } = useUser();
  const profile = user?.currentOrganization;
  const [content, setContent] = useState('');
  const t = useTranslations();
  const utils = trpc.useContext();
  if (!profile) {
    return null;
  }

  const createPost = trpc.organization.createPost.useMutation({
    onMutate: (newPost) => {
      // Cancel any outgoing refetches for the posts query
      // await utils.organization.listPosts.cancel();
      // Snapshot the previous list of posts
      const previousPosts = utils.organization.listPosts.getData({
        slug: profile.slug,
      });

      // Optimistically update the cache with the new post
      // @ts-expect-error - temporary
      utils.organization.listPosts.setData({ slug: profile.slug }, (old) =>
        old
          ? [...old, { ...newPost, createdAt: new Date() }]
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
        { slug: profile.slug },
        context?.previousPosts || [],
      );
    },
    onSettled: () => {
      // Invalidate the posts query to sync with the server
      void utils.organization.listPosts.invalidate({ slug: profile.slug });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (content.trim()) {
      createPost.mutate({ id: profile.id, content });
      setContent('');
    }
  };

  const profileImageUrl = getPublicUrl(profile.avatarImage?.name);

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
        <FeedAvatar>
          {profileImageUrl ? (
            <Image
              src={profileImageUrl}
              alt=""
              fill
              className="!size-8 max-h-8 max-w-8 rounded-full"
            />
          ) : (
            <div className="size-8 rounded-full border bg-white" />
          )}
        </FeedAvatar>
        <FeedMain>
          <Form onSubmit={handleSubmit} className="flex w-full flex-row gap-4">
            <TextArea
              className="size-full h-10 min-h-10 overflow-y-hidden"
              variant="borderless"
              ref={textareaRef as RefObject<HTMLTextAreaElement>}
              placeholder={`Post an update…`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {content.length > 0 && (
              <Button color="secondary" type="submit">
                {t('Post')}
              </Button>
            )}
          </Form>
          <div className="flex gap-6">
            <div className="flex items-center gap-1 text-charcoal">
              <LuImage className="size-4" />
              {t('Media')}
            </div>
            <div className="flex items-center gap-1 text-charcoal">
              <LuPaperclip className="size-4" />
              {t('Resource')}
            </div>
          </div>
        </FeedMain>
      </FeedItem>
    </div>
  );
};
