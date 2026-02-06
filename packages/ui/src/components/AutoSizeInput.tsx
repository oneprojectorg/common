'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '../lib/utils';

export interface AutoSizeInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  minWidth?: number;
  'aria-label': string;
}

/**
 * Input that automatically resizes based on its content.
 * Respects CSS max-width from className.
 */
export function AutoSizeInput({
  value,
  onChange,
  className,
  inputRef,
  minWidth = 20,
  'aria-label': ariaLabel,
}: AutoSizeInputProps) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const inputContainerRef = useRef<HTMLInputElement>(null);
  const [width, setWidth] = useState(minWidth);

  useEffect(() => {
    if (measureRef.current) {
      let measuredWidth = measureRef.current.offsetWidth;
      measuredWidth = Math.max(minWidth, measuredWidth);

      // Respect CSS max-width from className applied to input
      const inputEl = inputRef?.current ?? inputContainerRef.current;
      if (inputEl) {
        const computedStyle = getComputedStyle(inputEl);
        const cssMaxWidth = parseFloat(computedStyle.maxWidth);
        if (!isNaN(cssMaxWidth) && cssMaxWidth > 0) {
          measuredWidth = Math.min(cssMaxWidth, measuredWidth);
        }
      }

      setWidth(measuredWidth);
    }
  }, [value, minWidth, inputRef]);

  return (
    <div className="relative inline-block">
      {/* Hidden span to measure text width */}
      <span
        ref={measureRef}
        className={cn(className, 'invisible absolute whitespace-pre')}
        aria-hidden="true"
      >
        {value || ''}
      </span>
      <input
        ref={inputRef ?? inputContainerRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(className, 'border-none bg-transparent outline-none')}
        style={{ width }}
        aria-label={ariaLabel}
      />
    </div>
  );
}
