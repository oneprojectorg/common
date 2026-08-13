import { EditorContent, type EditorContentProps } from '@tiptap/react';

import { cn } from '../../lib/utils';

export const StyledRichTextContent = ({
  className,
  ...props
}: EditorContentProps) => (
  <EditorContent
    {...props}
    className={cn('[&_div:focus-visible]:outline-auto', className)}
  />
);
