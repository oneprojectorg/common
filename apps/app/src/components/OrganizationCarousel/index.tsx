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
      setItemsPerPage(Math.ceil((e[0]?.contentRect.width ?? 1) / itemWidth));
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
      className="grid-areas-[.'scroller'.][.'tabs'.] relative z-50 grid flex-grow grid-cols-[min-content_1fr_min-content] grid-rows-[1fr_min-content] items-center gap-y-3"
      mouseDragging
      itemsPerPage={itemsPerPage}
      scrollPadding="2rem"
      spaceBetweenItems="1rem"
      scrollBy="item"
    >
      <CarouselScroller className="col-start-2 col-end-3 row-start-1 row-end-2 grid snap-x snap-mandatory !auto-cols-auto grid-flow-col gap-x-2 overflow-x-auto overflow-y-hidden scrollbar-none">
        {children}
      </CarouselScroller>
    </Carousel>
  );
};

export { CarouselItem };
