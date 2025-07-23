'use client';

import { getPublicUrl } from '@/utils';
import { OrganizationUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { Header3 } from '@op/ui/Header';
import { Modal, ModalHeader, ModalBody } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/Dialog';
import { TextArea } from '@op/ui/Field';
import { toast } from '@op/ui/Toast';
import { RefObject, useEffect, useRef, useState } from 'react';
import { LuX, LuMessageCircle, LuSend } from 'react-icons/lu';

import { formatRelativeTime } from '../PostFeed';
import { PostItem } from '../PostItem';

interface Comment {
  id: string;
  content: string;
  createdAt: string | null;
  profile: {
    id: string;
    name: string;
    slug: string;
    avatarImage: {
      id: string;
      name: string;
      metadata: any;
    } | null | undefined;
  } | null;
  parentCommentId: string | null;
}

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  postData: {
    organization: any;
    post: any;
  };
  user?: OrganizationUser;
}

const CommentInput = ({ 
  postId, 
  user, 
  onCommentCreated 
}: { 
  postId: string; 
  user?: OrganizationUser;
  onCommentCreated: () => void;
}) => {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  const createComment = trpc.comments.createComment.useMutation({
    onSuccess: () => {
      setContent('');
      onCommentCreated();
      utils.comments.getComments.invalidate({ commentableType: 'post', commentableId: postId });
      toast.success({ message: 'Comment posted!' });
    },
    onError: (error) => {
      toast.error({ message: error.message || 'Failed to post comment' });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    
    createComment.mutate({
      content: content.trim(),
      commentableType: 'post',
      commentableId: postId,
    });
  };

  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const adjustHeight = () => {
        textarea.style.height = '1.5rem';
        textarea.style.height = `${textarea.scrollHeight}px`;
      };
      
      textarea.addEventListener('input', adjustHeight);
      return () => textarea.removeEventListener('input', adjustHeight);
    }
  }, []);

  return (
    <div className="flex gap-3">
      {user?.currentOrganization && (
        <div className="size-8 min-w-8 overflow-hidden rounded-full bg-primary-teal">
          {user.currentOrganization.profile.avatarImage ? (
            <img
              src={getPublicUrl(user.currentOrganization.profile.avatarImage.name) || ''}
              alt={user.currentOrganization.profile.name}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-xs font-medium text-white">
              {user.currentOrganization.profile.name.charAt(0)}
            </div>
          )}
        </div>
      )}
      <div className="flex w-full items-start gap-2">
        <div className="flex-1">
          <TextArea
            className="w-full min-h-[2rem] resize-none border border-neutral-gray1 rounded-lg px-3 py-2 text-sm placeholder-neutral-gray4 focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal"
            variant="borderless"
            ref={textareaRef as RefObject<HTMLTextAreaElement>}
            placeholder="Write a comment…"
            value={content}
            onChange={(e) => setContent(e.target.value ?? '')}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button
          size="small"
          color="primary"
          onPress={handleSubmit}
          isPending={createComment.isPending}
          isDisabled={!content.trim() || content.length > 240}
          className="shrink-0"
        >
          <LuSend className="size-4" />
        </Button>
      </div>
    </div>
  );
};

const CommentItem = ({ comment }: { comment: Comment }) => {
  return (
    <div className="flex gap-3">
      <div className="size-8 min-w-8 overflow-hidden rounded-full bg-neutral-gray1">
        {comment.profile?.avatarImage?.name ? (
          <img
            src={getPublicUrl(comment.profile.avatarImage.name) || ''}
            alt={comment.profile.name}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-primary-teal text-xs font-medium text-white">
            {comment.profile?.name?.charAt(0) || '?'}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-black">
            {comment.profile?.name}
          </span>
          <span className="text-xs text-neutral-gray4">
            {comment.createdAt ? formatRelativeTime(comment.createdAt) : ''}
          </span>
        </div>
        <p className="text-sm text-neutral-charcoal leading-normal break-words">
          {comment.content}
        </p>
      </div>
    </div>
  );
};

export const CommentModal = ({ 
  isOpen, 
  onClose, 
  postData, 
  user 
}: CommentModalProps) => {
  const { data: comments, refetch } = trpc.comments.getComments.useQuery(
    {
      commentableType: 'post',
      commentableId: postData.post.id,
      limit: 50,
    },
    { enabled: isOpen }
  );

  const handleCommentCreated = () => {
    refetch();
  };

  if (!isOpen) return null;

  return (
    <DialogTrigger isOpen={isOpen}>
      <Button style={{ display: 'none' }}>Hidden Trigger</Button>
      <Modal 
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        className="w-full max-w-lg"
      >
        <ModalHeader className="flex items-center justify-between p-4 border-b border-neutral-gray1">
          <Header3 className="font-medium text-neutral-black">Comments</Header3>
          <Button
            variant="icon" 
            size="small"
            onPress={onClose}
            className="size-8 rounded-full p-2 hover:bg-neutral-gray1"
          >
            <LuX className="size-4" />
          </Button>
        </ModalHeader>

        <ModalBody className="flex flex-col max-h-[70vh] p-0">
          {/* Full Post Display */}
          <div className="border-b border-neutral-gray1 p-4">
            <PostItem
              organization={postData.organization}
              post={postData.post}
              user={user}
              withLinks={false}
              withActions={false}
            />
          </div>
          
          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-4">
            {comments && comments.length > 0 ? (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <CommentItem key={comment.id} comment={comment as Comment} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-gray4">
                <LuMessageCircle className="size-12 mb-4" />
                <p className="text-sm">No comments yet. Be the first to comment!</p>
              </div>
            )}
          </div>

          {/* Comment Input */}
          <div className="border-t border-neutral-gray1 p-4">
            <CommentInput 
              postId={postData.post.id} 
              user={user} 
              onCommentCreated={handleCommentCreated} 
            />
          </div>
        </ModalBody>
      </Modal>
    </DialogTrigger>
  );
};