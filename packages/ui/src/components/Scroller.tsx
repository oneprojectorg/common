import { useGesture } from '@use-gesture/react';
import { debounce } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cn } from '../lib/utils';

interface ScrollerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'ref'> {
  fromColor?: `from-neutral-${number}`;
  disableAutoScroll?: boolean;
  fadeMode?: 'absolute' | 'mask';
}

export const Scroller = ({
  children,
  className,
  fromColor,
  disableAutoScroll,
  fadeMode = 'absolute',
  ...props
}: ScrollerProps) => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const [showShadowTop, setShowShadowTop] = useState(false);
  const [showShadowBottom, setShowShadowBottom] = useState(false);
  const [scrollPercentage, setScrollPercentage] = useState(0);

  // If the container is tall enough to scroll, add a scrollbar
  const [hasScrollbar, setHasScrollbar] = useState(false);

  const isDraggingRef = useRef(false);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isUserScrolling = useRef(false);

  const debounceIsUserScrolling = useCallback(
    debounce((value: boolean) => {
      isUserScrolling.current = value;
    }, 200),
    [],
  );

  const handleScroll = useCallback(
    (autoscroll = false) => {
      if (scrollerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollerRef.current;

        const shouldScroll = scrollHeight - scrollTop - clientHeight < 50;

        // Only update shouldAutoScroll when user is actually scrolling
        if (autoscroll && !disableAutoScroll) {
          if (!isUserScrolling.current) {
            scrollerRef.current.scrollTop = scrollHeight;
            //   scrollerRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
          } else if (shouldScroll) {
            debounceIsUserScrolling(false);
            //   isUserScrolling.current = false;
          }
        }

        setShowShadowTop(scrollTop > 4);
        setShowShadowBottom(scrollTop + clientHeight < scrollHeight - 4);

        const maxScroll = scrollHeight - clientHeight;
        const currentPercentage = (scrollTop / maxScroll) * 100;

        setScrollPercentage(currentPercentage);
      }
    },
    [scrollerRef.current],
  );

  const handleScrollDragMove = (e: MouseEvent) => {
    if (
      !isDraggingRef.current ||
      !scrollerRef.current ||
      !scrollTrackRef.current
    ) {
      return;
    }

    const { top: trackTop, height: trackHeight } =
      scrollTrackRef.current.getBoundingClientRect();
    const scrollableHeight =
      scrollerRef.current.scrollHeight - scrollerRef.current.clientHeight;

    // Calculate relative position within the track
    const relativeY = Math.max(
      0,
      Math.min(1, (e.clientY - trackTop) / trackHeight),
    );

    // Apply scroll
    scrollerRef.current.scrollTop = relativeY * scrollableHeight;
  };

  const handleScrollDragEnd = () => {
    setIsDragging(false);
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleScrollDragMove);
    document.removeEventListener('mouseup', handleScrollDragEnd);
  };

  const handleScrollDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    isDraggingRef.current = true;
    document.addEventListener('mousemove', handleScrollDragMove);
    document.addEventListener('mouseup', handleScrollDragEnd);
  };

  const mutationObserver = useMemo(() => {
    // Create observer to track both content changes and image loads
    const mutationObserver = new MutationObserver((_e) => {
      if (scrollerRef.current) {
        // Check for scrollHeight changes
        handleScroll(true);
        setHasScrollbar(
          scrollerRef.current.scrollHeight > scrollerRef.current.clientHeight,
        );

        // Handle image loads
        const images = scrollerRef.current.getElementsByTagName('img') || [];

        Array.from(images).forEach((img) => {
          if (!img.complete) {
            img.addEventListener(
              'load',
              () => {
                handleScroll(true);
              },
              { once: true },
            );
          }
        });
      }
    });

    return mutationObserver;
  }, [scrollerRef.current]);

  useEffect(() => {
    // Initial scroll check
    if (scrollerRef.current) {
      handleScroll(true);
      setHasScrollbar(
        scrollerRef.current.scrollHeight > scrollerRef.current.clientHeight,
      );
    }

    if (scrollerRef.current) {
      mutationObserver.observe(scrollerRef.current, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });
    }

    return () => {
      mutationObserver.disconnect();
    };
  }, [scrollerRef.current, mutationObserver]); // Remove the dependencies since we're observing changes directly

  useEffect(() => {
    if (scrollerRef.current && !disableAutoScroll) {
      const { scrollHeight } = scrollerRef.current;

      scrollerRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    }
  }, [scrollerRef?.current, disableAutoScroll]);

  useGesture(
    {
      onScroll: () => {
        handleScroll();
      },
      onWheel: () => {
        isUserScrolling.current = true;
      },
      onTouchStart: () => {
        isUserScrolling.current = true;
      },
      onMouseDown: () => {
        isUserScrolling.current = true;
      },
      onMouseUp: () => {
        isUserScrolling.current = false;
      },
      onTouchEnd: () => {
        isUserScrolling.current = false;
      },
      onPointerLeave: () => {
        isUserScrolling.current = false;
      },
      onMouseLeave: () => (isUserScrolling.current = false),
    },
    {
      target: scrollerRef,
    },
  );

  return (
    <div className="group/scroller-wrapper relative size-full">
      <div
        ref={scrollerRef}
        id="content"
        className={cn('scrollable-hidden-scrollbar scroller h-full', className)}
        {...props}
        tabIndex={-1}
        role="presentation"
        style={
          fadeMode === 'mask'
            ? {
                maskImage: `linear-gradient(to bottom, rgba(0, 0, 0, ${showShadowTop ? '0' : '1'}) 0%, rgb(0, 0, 0) 24px, rgb(0, 0, 0) calc(100% - 24px), rgba(0, 0, 0, ${showShadowBottom ? '0' : '1'}) 100%)`,
              }
            : {}
        }
      >
        {children}
      </div>
      {fadeMode === 'absolute' && (
        <>
          {/* The single pixel offsets are to combat subpixel rendering */}
          <div
            className={cn(
              'pointer-events-none absolute -left-px -top-px w-[calc(100%+2px)] bg-gradient-to-b to-transparent duration-500',
              fromColor ? `${fromColor}` : 'from-neutral-100',

              showShadowTop ? 'h-6 opacity-100' : 'h-0 opacity-0',
            )}
          />
          <div
            className={cn(
              'pointer-events-none absolute -bottom-px -left-px w-[calc(100%+2px)] bg-gradient-to-t to-transparent duration-500',
              fromColor ? `${fromColor}` : 'from-neutral-100',
              showShadowBottom ? 'h-6 opacity-100' : 'h-0 opacity-0',
            )}
          />
        </>
      )}
      {hasScrollbar && (
        <div
          ref={scrollTrackRef}
          role="scrollbar"
          aria-controls={scrollerRef.current?.id || 'content'}
          aria-orientation="vertical"
          aria-valuenow={scrollPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={-1}
          className={cn(
            'absolute right-0 top-0 h-full w-2 opacity-0 outline-none transition-opacity duration-300 group-hover/scroller-wrapper:opacity-100',
            isDragging && 'opacity-100',
          )}
          onMouseDown={handleScrollDragStart}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') scrollerRef.current?.scrollBy(0, -50);
            if (e.key === 'ArrowDown') scrollerRef.current?.scrollBy(0, 50);
          }}
        >
          <div
            className={cn(
              'pointer-events-auto absolute right-0 w-2 rounded-full transition-colors',
              isDragging
                ? 'bg-neutral-500/90'
                : 'bg-neutral-500/50 hover:bg-neutral-500/70',
            )}
            style={{
              top: `${scrollPercentage}%`,
              height: `${((scrollerRef.current?.clientHeight || 0) / (scrollerRef.current?.scrollHeight || 1)) * 100}%`,
              transform: `translateY(-${scrollPercentage}%)`,
            }}
          />
        </div>
      )}
    </div>
  );
};
