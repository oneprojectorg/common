// Stacked-avatar group built on vanilla shadcn `AvatarGroup` +
// `AvatarGroupCount`. Two modes:
//   - Static: pass `items`, every item renders.
//   - Growing: pass `maxItems`, container width drives how many fit and
//     overflow renders as a +N chip.

'use client';

import {
  forwardRef,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { AvatarGroup, AvatarGroupCount } from './ui/avatar';

interface FacePileProps {
  items: Array<ReactNode>;
  /** Slot rendered after the stack (e.g. a label or count). */
  children?: ReactNode;
  className?: string;
  /** Cap on rendered items. When set, the pile auto-shrinks to whatever
   * fits in the container width and overflow renders as a +N chip. */
  maxItems?: number;
}

// Avatar = 32px, overlap = -space-x-2 = 8px, so each subsequent face adds
// 24px. Used to estimate how many fit at the current width.
const FACE_STRIDE_PX = 32 - 8;

export const FacePile = forwardRef<HTMLDivElement, FacePileProps>(
  function FacePile({ items, children, className, maxItems }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

    const [fitCount, setFitCount] = useState(maxItems ?? items.length);

    useEffect(() => {
      if (maxItems === undefined) {
        return;
      }
      if (!containerRef.current) {
        return;
      }
      const observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width ?? 0;
        setFitCount(Math.min(Math.floor(width / FACE_STRIDE_PX), maxItems));
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, [maxItems]);

    const renderCount = maxItems === undefined ? items.length : fitCount;
    const renderedItems = items.slice(0, renderCount);
    const overflow = items.length - renderCount;

    return (
      <div
        ref={containerRef}
        className="flex w-full max-w-fit flex-wrap items-center gap-2"
      >
        <AvatarGroup className={className}>
          {renderedItems.map((node, i) => (
            <span key={i} className="contents">
              {node}
            </span>
          ))}
          {overflow > 0 && <AvatarGroupCount>+{overflow}</AvatarGroupCount>}
        </AvatarGroup>
        {children}
      </div>
    );
  },
);

export default FacePile;
