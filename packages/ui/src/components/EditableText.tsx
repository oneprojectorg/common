/* eslint-disable jsx-a11y/no-autofocus */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { useCallback, useRef, useState } from 'react';

import { cn } from '../lib/utils';

import type { InputHTMLAttributes } from 'react';

type EventType = React.MouseEvent<HTMLDivElement, MouseEvent>;

const useDoubleClick = (
  onClick: (e: EventType) => void,
  onDbClick: (e: EventType) => void,
  delay = 200,
) => {
  const timePassed = useRef(0);

  return (e: EventType) => {
    if (e.detail === 1) {
      setTimeout(() => {
        if (Date.now() - timePassed.current >= delay) {
          onClick(e);
        }
      }, delay);
      e.stopPropagation();
      e.preventDefault();
    }

    if (e.detail >= 2) {
      timePassed.current = Date.now();
      onDbClick(e);
      e.stopPropagation();
      e.preventDefault();
    }
  };
};

export const EditableText = ({
  children,
  onClick,
  onSubmit,
  useInput = false,
  maxLength = 120,
  disabled = false,
  rows = 4,
  proceedWithDoubleClick = () => true,
  inputClassName,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onSubmit' | 'onClick'> & {
  children: string | null;
  onClick: (e?: EventType) => void;
  onSubmit?: (v: string) => void;
  useInput?: boolean;
  maxLength?: number;
  disabled?: boolean;
  proceedWithDoubleClick?: () => boolean;
  rows?: number;
  inputClassName?: string;
}) => {
  const [isEditable, setIsEditable] = useState(false);
  const [content, setContent] = useState(children);

  const singleClick = useCallback(
    (e: EventType) => {
      if (!isEditable) {
        onClick(e);
      }

      e.stopPropagation();
      e.preventDefault();
    },
    [isEditable],
  );

  const doubleClick = (e: EventType) => {
    const canEdit = proceedWithDoubleClick();

    if (canEdit) {
      e.stopPropagation();
      e.preventDefault();
      setIsEditable(true);
    }
  };

  const onChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    if (e.target.value.length <= maxLength) {
      setContent(e.target.value.replace(/\r\n|\n|\r/g, ''));
    }

    e.stopPropagation();
    e.preventDefault();
  };

  const myDoubleClickCallback = useDoubleClick(singleClick, doubleClick);

  const submit = useCallback(() => {
    if (!onSubmit)
      return;

    if (content && content.trim() !== '') {
      onSubmit(content);
    }
    else if (props.placeholder) {
      onSubmit(props.placeholder);
    }
    else {
      setContent(children);
    }

    setIsEditable(false);
  }, [content]);

  if (isEditable && useInput && !disabled) {
    return (
      <input
        {...props}
        className={cn('nopan nodrag bg-transparent p-0 leading-[inherit] text-[inherit] !outline-none !ring-0 !ring-offset-0 placeholder:text-neutral-500', inputClassName)}
        value={content || ''}
        placeholder={props.placeholder || 'Untitled'}
        onClick={(e) => {
          const canEdit = proceedWithDoubleClick();

          if (canEdit) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        onChange={onChange}
        onBlur={(e) => {
          e.stopPropagation();
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();

          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        onDoubleClick={(e) => {
          const canEdit = proceedWithDoubleClick();

          if (canEdit) {
            e.stopPropagation();
          }
        }}
        autoFocus={isEditable}
        onFocus={(e) => {
          e.target.select();
        }}
      />
    );
  }

  if (isEditable && !disabled) {
    return (
      <textarea
        className={cn('nopan nodrag w-full resize-none border-none bg-transparent p-0 !outline-none !ring-0 !ring-offset-0 placeholder:text-neutral-500', inputClassName)}
        value={content || undefined}
        placeholder={props.placeholder || 'Double click to edit...'}
        rows={rows}
        onClick={(e) => {
          const canEdit = proceedWithDoubleClick();

          if (canEdit) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        onChange={onChange}
        onBlur={(e) => {
          e.stopPropagation();
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.stopPropagation();
            e.preventDefault();
            submit();
          }
        }}
        onDoubleClick={(e) => {
          const canEdit = proceedWithDoubleClick();

          if (canEdit) {
            e.stopPropagation();
          }
        }}
        autoFocus={isEditable}
        onFocus={(e) => {
          e.target.select();
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        'w-full break-words',
        props.className,
      )}
      onClick={(e) => {
        const canEdit = proceedWithDoubleClick();

        if (canEdit) {
          myDoubleClickCallback(e);
        }
      }}
      suppressContentEditableWarning
    >
      {content || children || 'Double click to edit...'}
    </div>
  );
};

