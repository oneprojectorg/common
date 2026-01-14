import { ReactElement, useEffect, useRef, useState } from 'react';
import { Carousel, CarouselItem, CarouselScroller } from 'react-aria-carousel';

export const OrganizationCarousel = ({
  children,
  label,
  itemWidth,
}: {
  children: ReactElement;
  label?: string;
  itemWidth: number;
}) => {
  const carouselRef = useRef(null);
  const [itemsPerPage, setItemsPerPage] = useState(1.25);

  useEffect(() => {
    if (!carouselRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver((e) => {
      setItemsPerPage((e[0]?.contentRect.width ?? 1) / itemWidth);
    });

    resizeObserver.observe(carouselRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [carouselRef]);

  return (
    <Carousel
      ref={carouselRef}
      aria-label={label}
      className="grid-areas-[.'scroller'.][.'tabs'.] relative grid grow grid-cols-[min-content_1fr_min-content] grid-rows-[1fr_min-content] items-center gap-y-3"
      mouseDragging
      itemsPerPage={itemsPerPage}
    >
      <CarouselScroller className="col-start-2 col-end-3 row-start-1 row-end-2 scrollbar-none grid snap-x snap-mandatory auto-cols-auto grid-flow-col overflow-x-auto overflow-y-hidden">
        {children}
      </CarouselScroller>
    </Carousel>
  );
};

export { CarouselItem };
