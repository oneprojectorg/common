import { EditorContent, type EditorContentProps } from '@tiptap/react';

import { cn } from '../../lib/utils';

export const StyledRichTextContent = ({
  className,
  ...props
}: EditorContentProps) => (
  <EditorContent
    {...props}
    className={cn(
      '[&_div:focus-visible]:outline-auto',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-data-blue',
      className,
    )}
  />
);
