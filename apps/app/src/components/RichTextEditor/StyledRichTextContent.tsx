import { cn } from '@op/ui/utils';
import { EditorContent, EditorContentProps } from '@tiptap/react';

export const StyledRichTextContent = ({
  className,
  ...props
}: EditorContentProps) => (
  <EditorContent
    className={cn(
      'overflow-wrap-anywhere max-w-none break-words leading-5 focus:outline-none',
      '[&_a:hover]:underline [&_a]:text-teal [&_a]:no-underline',
      '[&_:is(h1,h2)]:font-serif [&_h1]:text-title-lg [&_h2]:text-title-md [&_h3]:text-title-base',
      className,
    )}
    {...props}
  />
);
