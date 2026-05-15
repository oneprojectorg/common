// Compat wrapper for @op/ui's GrowingFacePile. Wraps FacePile (shadcn
// AvatarGroup) + AvatarGroupCount overflow indicator.

import { type ReactNode, useEffect, useRef, useState } from 'react';

import { FacePile } from './FacePile';
import { AvatarGroupCount } from './ui/avatar';

export const GrowingFacePile = ({
  children,
  items,
  maxItems = 20,
}: {
  children?: ReactNode;
  items: Array<ReactNode>;
  maxItems?: number;
}) => {
  const facePileRef = useRef<HTMLDivElement>(null);
  const [numItems, setNumItems] = useState(maxItems);

  useEffect(() => {
    if (!facePileRef.current) return;
    const resizeObserver = new ResizeObserver((e) => {
      // each avatar 32px wide - 8px overlap = 24px stride
      setNumItems(
        Math.min(
          Math.floor((e[0]?.contentRect.width ?? 1) / (32 - 8)),
          maxItems,
        ),
      );
    });
    resizeObserver.observe(facePileRef.current);
    return () => resizeObserver.disconnect();
  }, [maxItems]);

  const renderedItems = items.slice(0, numItems);
  const overflow = items.length - numItems;

  if (overflow > 0) {
    renderedItems.push(<AvatarGroupCount key="overflow">+{overflow}</AvatarGroupCount>);
  }

  return (
    <FacePile items={renderedItems} ref={facePileRef}>
      {children}
    </FacePile>
  );
};
