import { EditorContent, EditorContentProps } from '@tiptap/react';

import { cn } from '../../lib/utils';

export const StyledRichTextContent = ({
  className,
  ...props
}: EditorContentProps) => (
  <EditorContent
    {...props}
    className={cn(
      'overflow-wrap-anywhere [&_div:focus-visible]:outline-auto max-w-none break-words leading-5 focus:outline-none',
      '[&_a:hover]:underline [&_a]:text-teal [&_a]:no-underline',
      '[&_:is(h1,h2)]:font-serif [&_h1]:text-title-lg [&_h2]:text-title-md [&_h3]:text-title-base',
      '[&_:is(h1,h2)]:my-4',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-data-blue',
      className,
    )}
  />
);
