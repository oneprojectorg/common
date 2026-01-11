import { ReactNode, useEffect, useRef, useState } from 'react';

import { Avatar } from '../Avatar';
import { FacePile } from '../FacePile';

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
    if (!facePileRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver((e) => {
      // divide by 2 rem - 0.5 rem overlap
      setNumItems(
        Math.min(
          Math.floor((e[0]?.contentRect.width ?? 1) / (32 - 8)),
          maxItems,
        ),
      );
    });

    resizeObserver.observe(facePileRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [facePileRef]);

  const renderedItems = items.slice(0, numItems);

  if (items.length > numItems) {
    renderedItems.push(
      <Avatar className="bg-neutral-charcoal text-neutral-offWhite text-sm">
        <span className="align-super">+</span>
        {items.length - numItems}
      </Avatar>,
    );
  }

  return (
    <FacePile items={renderedItems} ref={facePileRef}>
      {children}
    </FacePile>
  );
};
