import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@op/sense/Carousel';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof Carousel> = {
  title: 'Sense/Carousel',
  component: Carousel,
  decorators: [withSense],
};

export default meta;

type Story = StoryObj<typeof Carousel>;

export const Default: Story = {
  render: () => (
    <div className="mx-12 w-80">
      <Carousel>
        <CarouselContent>
          {[1, 2, 3, 4, 5].map((n) => (
            <CarouselItem key={n}>
              <div className="flex aspect-square items-center justify-center rounded-xl border border-border bg-muted text-title">
                {n}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  ),
};

export const MultipleItems: Story = {
  render: () => (
    <div className="mx-12 w-full max-w-sm">
      <Carousel>
        <CarouselContent>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <CarouselItem key={n} className="basis-1/3">
              <div className="flex aspect-square items-center justify-center rounded-xl border border-border bg-muted text-title">
                {n}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  ),
};
