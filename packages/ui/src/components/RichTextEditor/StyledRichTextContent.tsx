import { EditorContent, EditorContentProps } from '@tiptap/react';

import { cn } from '../../lib/utils';

export const StyledRichTextContent = ({
  className,
  ...props
}: EditorContentProps) => (
  <EditorContent
    {...props}
    className={cn(
      '[&_div:focus-visible]:outline-auto leading-5',
      '[&_:is(h1,h2)]:my-4 [&_:is(h1,h2)]:font-serif [&_h1]:text-title-lg [&_h2]:text-title-md [&_h3]:text-title-base', // header styles
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-data-blue',
      className,
    )}
  />
);
